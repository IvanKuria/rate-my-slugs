// UCSC Rate My Professors Background Service Worker
// Handles RMP API calls and caching

class RMPBackgroundService {
  constructor() {
    this.UCSC_SCHOOL_ID = 'U2Nob29sLTEwNzg='; // Base64 encoded 'School-1078'
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.init();
  }

  init() {
    console.log('🎓 UCSC RMP Background Service initialized');
    console.log('🏫 UCSC School ID:', this.UCSC_SCHOOL_ID);
    this.setupMessageHandlers();
  }

    setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Background received message:', request);

      if (request.action === 'getProfessorRating') {
        console.log(`🔍 Processing rating request for: ${request.instructorName}`);
        this.handleProfessorRatingRequest(request, sender, sendResponse);
        return true; // Keep message channel open for async response
      } else if (request.action === 'clearCache') {
        console.log('🧹 Clearing cache');
        this.handleClearCacheRequest(request, sender, sendResponse);
        return true;
      } else if (request.action === 'refreshProfessor') {
        console.log(`🔄 Refreshing data for: ${request.instructorName}`);
        this.handleRefreshProfessorRequest(request, sender, sendResponse);
        return true;
      }

      console.log('❌ Unknown message action:', request.action);
    });
  }

  async handleClearCacheRequest(request, sender, sendResponse) {
    try {
      console.log('🧹 Clearing memory cache...');
      this.cache.clear();
      
      console.log('🧹 Clearing chrome storage...');
      await chrome.storage.local.clear();
      
      console.log('✅ Cache cleared successfully');
      sendResponse({ success: true, message: 'Cache cleared successfully' });
    } catch (error) {
      console.error('Error clearing cache:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleRefreshProfessorRequest(request, sender, sendResponse) {
    const { instructorName } = request;
    
    try {
      console.log(`🧹 Clearing cache for ${instructorName}...`);
      // Clear cache for this specific professor
      this.cache.delete(instructorName);
      await chrome.storage.local.remove(instructorName);
      
      console.log(`🔄 Fetching fresh data for ${instructorName}...`);
      // Fetch fresh data
      const result = await this.fetchProfessorRating(instructorName);
      sendResponse(result);
    } catch (error) {
      console.error('Error refreshing professor:', error);
      sendResponse({
        status: 'error',
        instructorName: instructorName,
        error: error.message
      });
    }
  }

  async handleProfessorRatingRequest(request, sender, sendResponse) {
    const { instructorName, department } = request;
    
    try {
      console.log(`⚡ NO CACHING - fetching fresh data for ${instructorName} (Department: ${department})`);
      const result = await this.fetchProfessorRating(instructorName, department);
      sendResponse(result);
    } catch (error) {
      console.error('Error handling professor rating request:', error);
      sendResponse({
        status: 'error',
        instructorName: instructorName,
        error: error.message
      });
    }
  }

  async getCachedRating(instructorName) {
    try {
      const result = await chrome.storage.local.get(`rmp_${instructorName}`);
      const cached = result[`rmp_${instructorName}`];
      
      if (cached && cached.timestamp) {
        const now = Date.now();
        const cacheAge = now - cached.timestamp;
        const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
        
        if (cacheAge < cacheTTL) {
          return cached.data;
        } else {
          // Expired cache, remove it
          await chrome.storage.local.remove(`rmp_${instructorName}`);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error checking cache:', error);
      return null;
    }
  }

  async cacheRating(instructorName, data) {
    try {
      await chrome.storage.local.set({
        [`rmp_${instructorName}`]: {
          data: data,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error caching rating:', error);
    }
  }

  async fetchProfessorRating(instructorName, department = null) {
    console.log(`Fetching rating for ${instructorName} (Department: ${department})`);
    
    try {
      // Normalize instructor name for search
      const normalizedName = this.normalizeInstructorName(instructorName);
      
      // Create multiple search strings
      const nameComponents = normalizedName.split(' ').map(part => part.toLowerCase().trim());
      const searchStrings = this.createSearchStrings(nameComponents);
      
      // Try multiple search variations
      let searchResult = [];
      for (const searchString of searchStrings) {
        const results = await this.searchProfessor(searchString);
        if (results.length > 0) {
          console.log(`🔍 Found ${results.length} professors total for search: "${searchString}"`);
          
          // If department is provided, filter by department context first
          let filteredResults = results;
          if (department) {
            const departmentMatches = this.filterByDepartmentContext(results, department);
            if (departmentMatches.length > 0) {
              console.log(`🏫 Found ${departmentMatches.length} professors with ${department} department context`);
              filteredResults = departmentMatches;
            } else {
              console.log(`🏫 No professors found with ${department} context, using all results`);
            }
          }
          
          // First, try to find exact matches
          const exactMatches = filteredResults.filter(professor => {
            const fullName = `${professor.firstName} ${professor.lastName}`;
            return fullName.toLowerCase() === normalizedName.toLowerCase();
          });
          
          if (exactMatches.length > 0) {
            console.log(`🎯 Found exact match for "${instructorName}" ${department ? `in ${department}` : ''}`);
            searchResult = exactMatches;
            break;
          }
          
          // If no exact match, try close matches
          const closeMatches = filteredResults.filter(professor => {
            const fullName = `${professor.firstName} ${professor.lastName}`;
            return this.isCloseEnough(fullName.toLowerCase(), normalizedName.toLowerCase());
          });
          
          if (closeMatches.length > 0) {
            console.log(`🔍 Found close match for "${instructorName}" ${department ? `in ${department}` : ''}`);
            searchResult = closeMatches;
            break;
          }
          
          // If still no matches, just take the first result as a fallback
          console.log(`🔄 No name matches found, using first result for "${instructorName}"`);
          searchResult = [filteredResults[0]];
          break;
        }
      }
      
      if (!searchResult || searchResult.length === 0) {
        const result = {
          status: 'no-profile',
          instructorName: instructorName
        };
        console.log(`⚡ Skipping cache - returning fresh result for ${instructorName}`);
        return result;
      }

      // Log all matches for debugging
      console.log(`🔍 Found ${searchResult.length} UCSC professor matches for "${instructorName}":`);
      searchResult.forEach((prof, idx) => {
        const fullName = `${prof.firstName} ${prof.lastName}`;
        const schoolName = prof.school ? prof.school.name : 'Unknown School';
        console.log(`  ${idx + 1}. ${fullName} at ${schoolName} - Rating: ${prof.avgRatingRounded}, Difficulty: ${prof.avgDifficultyRounded}, Reviews: ${prof.numRatings}, Would Take Again: ${prof.wouldTakeAgainPercentRounded}%`);
      });

      // Get detailed rating for the first match
      const professor = searchResult[0];
      const professorFullName = `${professor.firstName} ${professor.lastName}`;
      
      console.log(`✅ Using professor: ${professorFullName}`);
      console.log(`📊 Raw data:`, {
        avgRatingRounded: professor.avgRatingRounded,
        avgDifficultyRounded: professor.avgDifficultyRounded,
        wouldTakeAgainPercentRounded: professor.wouldTakeAgainPercentRounded,
        numRatings: professor.numRatings,
        id: professor.id,
        legacyId: professor.legacyId
      });
      
      const result = {
        status: 'success',
        instructorName: instructorName,
        matchedName: professorFullName,
        rating: {
          overallRating: (professor.avgRatingRounded !== null && professor.avgRatingRounded !== undefined) ? Math.round(professor.avgRatingRounded * 10) / 10 : 'N/A',
          difficulty: (professor.avgDifficultyRounded !== null && professor.avgDifficultyRounded !== undefined) ? Math.round(professor.avgDifficultyRounded * 10) / 10 : 'N/A',
          wouldTakeAgainPercent: (professor.wouldTakeAgainPercentRounded !== null && professor.wouldTakeAgainPercentRounded !== undefined && professor.wouldTakeAgainPercentRounded >= 0) ? Math.round(professor.wouldTakeAgainPercentRounded * 10) / 10 : 'N/A',
          numRatings: professor.numRatings || 0,
          rmpUrl: `https://www.ratemyprofessors.com/professor/${professor.id}`
        }
      };

      await this.cacheRating(instructorName, result);
      return result;

    } catch (error) {
      console.error('Error fetching professor rating:', error);
      return {
        status: 'error',
        instructorName: instructorName,
        error: error.message
      };
    }
  }

  normalizeInstructorName(name) {
    // Convert "Last,First." format to "First Last" for RMP search
    // Handle patterns like "Simons,J." "Smith,A.B." "O'Connor,M." etc.
    const match = name.match(/([A-Za-z'.-]+),([A-Za-z.]+)\.?/);
    if (match) {
      const lastName = match[1];
      const firstInitials = match[2];
      
      console.log(`📝 Normalizing "${name}" → "${firstInitials} ${lastName}"`);
      return `${firstInitials} ${lastName}`;
    }
    
    console.log(`📝 No normalization needed for "${name}"`);
    return name;
  }

  createSearchStrings(nameComponents) {
    const firstName = nameComponents[0];
    const lastName = nameComponents[nameComponents.length - 1];
    
    let searchStrings = [];
    
    // Basic variations
    searchStrings.push(`${lastName} ${firstName}`);
    searchStrings.push(`${firstName} ${lastName}`);
    
    // If first name is an initial, try expanding search
    if (firstName.length <= 2) {
      // Search with just the initial
      searchStrings.push(`${lastName} ${firstName.charAt(0)}`);
      searchStrings.push(`${firstName.charAt(0)} ${lastName}`);
      
      // Search with just last name (will be filtered by school)
      searchStrings.push(lastName);
    }
    
    // Also try the last name alone as a broader search
    if (!searchStrings.includes(lastName)) {
      searchStrings.push(lastName);
    }
    
    console.log(`🔍 Created search strings for "${firstName} ${lastName}":`, searchStrings);
    return searchStrings;
  }

  filterByDepartmentContext(professors, department) {
    // Map UCSC departments to related RMP course subjects/tags
    const departmentMappings = {
      'AM': ['applied mathematics', 'mathematics', 'math', 'applied math'],
      'ECON': ['economics', 'econ', 'business'],
      'PHYS': ['physics', 'physical science'],
      'CHEM': ['chemistry', 'chemical'],
      'BIOL': ['biology', 'biological', 'life science'],
      'PSYC': ['psychology', 'psych'],
      'HIST': ['history', 'historical'],
      'ENGL': ['english', 'literature', 'writing'],
      'CMPS': ['computer science', 'programming', 'computing'],
      'MATH': ['mathematics', 'math', 'calculus', 'algebra'],
      'ART': ['art', 'arts', 'visual arts'],
      'MUS': ['music', 'musical'],
      'THEA': ['theater', 'theatre', 'drama'],
      'POLI': ['political science', 'politics', 'government'],
      'ANTH': ['anthropology', 'cultural'],
      'SOCY': ['sociology', 'social science']
    };

    const relatedTerms = departmentMappings[department] || [department.toLowerCase()];
    console.log(`🏫 Looking for professors related to ${department}: ${relatedTerms.join(', ')}`);

    // Filter professors whose teaching tags or reviews mention related terms
    return professors.filter(professor => {
      // Check rating tags
      if (professor.teacherRatingTags) {
        for (const tag of professor.teacherRatingTags) {
          if (tag.tagName) {
            const tagName = tag.tagName.toLowerCase();
            if (relatedTerms.some(term => tagName.includes(term))) {
              console.log(`🏷️ Professor ${professor.firstName} ${professor.lastName} has relevant tag: ${tag.tagName}`);
              return true;
            }
          }
        }
      }

      // Check most useful rating content
      if (professor.mostUsefulRating && professor.mostUsefulRating.class) {
        const className = professor.mostUsefulRating.class.toLowerCase();
        if (relatedTerms.some(term => className.includes(term))) {
          console.log(`📚 Professor ${professor.firstName} ${professor.lastName} teaches relevant class: ${professor.mostUsefulRating.class}`);
          return true;
        }
      }

      return false;
    });
  }

  isCloseEnough(a, b) {
    // Simple Levenshtein distance implementation for name matching
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
        }
      }
    }

    const distance = matrix[a.length][b.length];
    const threshold = 3;
    return distance <= threshold;
  }

  async searchProfessor(name) {
    console.log(`🔍 Searching RMP API for: "${name}"`);
    
    // TEMPORARY: Test basic connectivity first
    try {
      console.log(`🧪 Testing basic RMP API connectivity...`);
      const testResponse = await fetch('https://www.ratemyprofessors.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Basic dGVzdDp0ZXN0'
        },
        body: JSON.stringify({
          query: `{ __typename }`,
          variables: {}
        })
      });
      console.log(`🧪 Basic connectivity test status: ${testResponse.status}`);
      const testData = await testResponse.json();
      console.log(`🧪 Basic connectivity test response:`, testData);
    } catch (error) {
      console.error(`🧪 Basic connectivity test failed:`, error);
    }
    
    const query = `query NewSearchTeachersQuery(
      $query: TeacherSearchQuery!
    ) {
      newSearch {
        teachers(query: $query) {
          didFallback
          edges {
            cursor
            node {
              id
              legacyId
              firstName
              lastName
              avgRatingRounded
              numRatings
              wouldTakeAgainPercentRounded
              wouldTakeAgainCount
              teacherRatingTags {
                id
                legacyId
                tagCount
                tagName
              }
              mostUsefulRating {
                id
                class
                isForOnlineClass
                legacyId
                comment
                helpfulRatingRounded
                ratingTags
                grade
                date
                iWouldTakeAgain
                qualityRating
                difficultyRatingRounded
                teacherNote{
                  id
                  comment
                  createdAt
                  class
                }
                thumbsDownTotal
                thumbsUpTotal
              }
              avgDifficultyRounded
              school {
                name
                id
              }
              department
            }
          }
        }
      }
    }`;

    const queryVars = {
      text: name,
      schoolID: this.UCSC_SCHOOL_ID
    };

    const body = JSON.stringify({
      query,
      variables: {
        query: queryVars,
      },
    });

    console.log(`📤 Sending RMP API request with body:`, body);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('https://www.ratemyprofessors.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Basic dGVzdDp0ZXN0'
        },
        body: body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

    console.log(`📥 RMP API response status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ RMP API error: HTTP ${response.status}: ${response.statusText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📊 RMP API response data:`, data);
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${data.errors.map(e => e.message).join(', ')}`);
    }

    // Extract professors from GraphQL response
    if (data.data && data.data.newSearch && data.data.newSearch.teachers && data.data.newSearch.teachers.edges) {
      const professors = data.data.newSearch.teachers.edges.map(edge => edge.node);
      console.log(`✅ Successfully extracted ${professors.length} professors from API response`);
      return professors;
    }

    console.log(`⚠️ No professors found in API response structure`);
    return [];
    
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`⏰ RMP API request timed out after 10 seconds`);
        throw new Error('Request timed out');
      } else {
        console.error(`❌ RMP API fetch error:`, error);
        throw error;
      }
    }
  }


}

// Initialize the background service
new RMPBackgroundService();
