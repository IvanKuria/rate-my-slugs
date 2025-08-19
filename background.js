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
      } else if (request.action === 'testMapping') {
        console.log(`🧪 Testing mapping for: ${request.instructorName}`);
        this.handleTestMappingRequest(request, sender, sendResponse);
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

  async handleTestMappingRequest(request, sender, sendResponse) {
    try {
      console.log(`🧪 Testing mapping for: "${request.instructorName}"`);
      
      // Check if manual mapping exists
      const mappedName = this.checkNameMapping(request.instructorName);
      
      if (mappedName) {
        console.log(`✅ Found mapping: "${request.instructorName}" → "${mappedName}"`);
        
        // Test search using the mapped name
        const searchResults = await this.searchProfessor(mappedName);
        console.log(`🔍 Search results for "${mappedName}":`, searchResults.length);
        
        if (searchResults.length > 0) {
          const exactMatch = searchResults.find(professor => {
            const professorFullName = `${professor.firstName} ${professor.lastName}`;
            return professorFullName.toLowerCase() === mappedName.toLowerCase();
          });
          
          if (exactMatch) {
            console.log(`🎯 Found exact match: ${exactMatch.firstName} ${exactMatch.lastName}`);
            sendResponse({
              status: 'success',
              mapping: `"${request.instructorName}" → "${mappedName}"`,
              found: true,
              professor: `${exactMatch.firstName} ${exactMatch.lastName}`,
              ratings: {
                overall: exactMatch.avgRatingRounded,
                difficulty: exactMatch.avgDifficultyRounded,
                wouldTakeAgain: exactMatch.wouldTakeAgainPercentRounded,
                numRatings: exactMatch.numRatings
              }
            });
          } else {
            console.log(`❌ No exact match found for "${mappedName}"`);
            sendResponse({
              status: 'mapping_exists_no_match',
              mapping: `"${request.instructorName}" → "${mappedName}"`,
              found: false,
              searchResultsCount: searchResults.length
            });
          }
        } else {
          console.log(`❌ No search results for "${mappedName}"`);
          sendResponse({
            status: 'mapping_exists_no_results',
            mapping: `"${request.instructorName}" → "${mappedName}"`,
            found: false
          });
        }
      } else {
        console.log(`❌ No mapping found for: "${request.instructorName}"`);
        sendResponse({
          status: 'no_mapping',
          instructorName: request.instructorName,
          found: false
        });
      }
    } catch (error) {
      console.error('Error testing mapping:', error);
      sendResponse({
        status: 'error',
        instructorName: request.instructorName,
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
    
    // Special debugging for Simons,J.
    if (instructorName === "Simons,J.") {
      console.log(`🚨 DEBUGGING SIMONS,J. - Starting fetch process`);
    }
    
    // Special debugging for Fehren-Schmitz,L.
    if (instructorName === "Fehren-Schmitz,L.") {
      console.log(`🚨 DEBUGGING FEHREN-SCHMITZ,L. - Starting fetch process`);
    }
    
    try {
      // Check manual name mapping first (highest priority)
      const mappedName = this.checkNameMapping(instructorName);
      if (mappedName) {
        console.log(`📋 Found manual mapping: "${instructorName}" → "${mappedName}"`);
        if (instructorName === "Simons,J.") {
          console.log(`🚨 SIMONS,J. MAPPED TO: "${mappedName}"`);
        }
        if (instructorName === "Fehren-Schmitz,L.") {
          console.log(`🚨 FEHREN-SCHMITZ,L. MAPPED TO: "${mappedName}"`);
        }
        return await this.searchByExactName(mappedName, instructorName);
      } else if (instructorName === "Simons,J.") {
        console.log(`🚨 SIMONS,J. NOT FOUND IN MAPPING!`);
        console.log(`🚨 Available mappings:`, Object.keys(this.checkNameMapping.toString().match(/\"([^\"]+)\"/g) || []));
      } else if (instructorName === "Fehren-Schmitz,L.") {
        console.log(`🚨 FEHREN-SCHMITZ,L. NOT FOUND IN MAPPING!`);
        console.log(`🚨 Available mappings:`, Object.keys(this.checkNameMapping.toString().match(/\"([^\"]+)\"/g) || []));
      }
      
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
          
          // If no exact match, try initial-based matching (more strict for single letters)
          const initialMatches = filteredResults.filter(professor => {
            return this.matchesWithInitial(professor, normalizedName);
          });
          
          if (initialMatches.length > 0) {
            console.log(`🔤 Found initial-based match for "${instructorName}" ${department ? `in ${department}` : ''}`);
            // Prefer professors with department context if available
            if (department) {
              const deptMatches = this.filterByDepartmentContext(initialMatches, department);
              if (deptMatches.length > 0) {
                searchResult = deptMatches;
                console.log(`🏫 Prioritizing ${deptMatches.length} department matches over ${initialMatches.length} total matches`);
              } else {
                searchResult = initialMatches;
              }
            } else {
              searchResult = initialMatches;
            }
            break;
          }
          
          // If still no matches, try close matches (most permissive) but be more strict
          const closeMatches = filteredResults.filter(professor => {
            const fullName = `${professor.firstName} ${professor.lastName}`;
            const similarity = this.calculateSimilarity(fullName.toLowerCase(), normalizedName.toLowerCase());
            // Only accept very close matches (similarity > 0.8)
            return similarity > 0.8;
          });
          
          if (closeMatches.length > 0) {
            console.log(`🔍 Found close match for "${instructorName}" ${department ? `in ${department}` : ''}`);
            searchResult = closeMatches;
            break;
          }
          
          // NO MORE FALLBACK TO RANDOM RESULTS
          console.log(`❌ No valid matches found for "${instructorName}" - professor may not exist on RMP`);
          // Continue to next search string instead of using random result
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
      console.log(`🔍 Found ${searchResult.length} professor matches for "${instructorName}":`);
      searchResult.forEach((prof, idx) => {
        const fullName = `${prof.firstName} ${prof.lastName}`;
        console.log(`  ${idx + 1}. ${fullName} - Rating: ${prof.avgRatingRounded}, Difficulty: ${prof.avgDifficultyRounded}, Reviews: ${prof.numRatings}, Would Take Again: ${prof.wouldTakeAgainPercentRounded}%, ID: ${prof.legacyId}`);
        
        // Show top teaching tags for context
        if (prof.teacherRatingTags && prof.teacherRatingTags.length > 0) {
          const topTags = prof.teacherRatingTags.slice(0, 3).map(tag => tag.tagName).join(', ');
          console.log(`    Tags: ${topTags}`);
        }
        
        // Show recent class if available
        if (prof.mostUsefulRating && prof.mostUsefulRating.class) {
          console.log(`    Recent class: ${prof.mostUsefulRating.class}`);
        }
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
          wouldTakeAgainPercent: (professor.wouldTakeAgainPercentRounded !== null && professor.wouldTakeAgainPercentRounded !== undefined && professor.wouldTakeAgainPercentRounded >= 0) ? Math.round(professor.wouldTakeAgainPercentRounded) : 'N/A',
          numRatings: professor.numRatings || 0,
          rmpUrl: `https://www.ratemyprofessors.com/professor/${professor.legacyId}`
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

  checkNameMapping(instructorName) {
    // Manual mapping dictionary: UCSC name → RMP name OR RMP ID
    const nameMapping = {
      // Format options:
      // "UCSC_Format": "RMP_Full_Name"  (searches by name)
      // "UCSC_Format": "ID:12345"       (direct RMP professor ID)
      "Berrahmoun,A.": "Abdelkader Berrahmoun",
      "Hibbert-Jones,W.D.": "Dee Hibbert-Jones",
      "Hernandez Garavito,C.": "Carla Hernandez Garavito",
      "Mascarenhas Menna Barreto,J.": "Jorge Barreto",
      "Shange-Binion,S.T.": "Savannah Shange",
      "Kilpatrick,A.M.": "Marm Kilpatrick",
      
      
      // Test with some variations in case exact names don't match:
      "Simons,J.": "Julie Simons",
      "Fehren-Schmitz,L.": "Lars Fehren-Schmitz",
      "Ramirez-Ruiz,E.J.": "Enrico Ramirez-Ruiz",
      
      
      // Example of direct ID mapping (more reliable):
      // "Smith,J.": "ID:2367890",
      
      // Add more mappings as discovered:
      // "Professor,X.": "Full Name on RMP",
    };
    
    return nameMapping[instructorName] || null;
  }

  async searchByExactName(fullName, originalInstructorName) {
    console.log(`🎯 Searching for exact mapped name: "${fullName}"`);
    
    // Special debugging for Simons,J.
    if (originalInstructorName === "Simons,J.") {
      console.log(`🚨 SIMONS,J. - Searching RMP for: "${fullName}"`);
    }
    
    // Special debugging for Fehren-Schmitz,L.
    if (originalInstructorName === "Fehren-Schmitz,L.") {
      console.log(`🚨 FEHREN-SCHMITZ,L. - Searching RMP for: "${fullName}"`);
    }
    
    try {
      // Search using the exact full name
      const results = await this.searchProfessor(fullName);
      
      if (originalInstructorName === "Simons,J.") {
        console.log(`🚨 SIMONS,J. - RMP Search Results:`, results.length, results);
      }
      
      if (originalInstructorName === "Fehren-Schmitz,L.") {
        console.log(`🚨 FEHREN-SCHMITZ,L. - RMP Search Results:`, results.length, results);
      }
      
      if (results.length > 0) {
        // Find the best match (should be exact since we have the full name)
        const exactMatch = results.find(professor => {
          const professorFullName = `${professor.firstName} ${professor.lastName}`;
          return professorFullName.toLowerCase() === fullName.toLowerCase();
        });
        
        if (exactMatch) {
          console.log(`✅ Found exact match for mapped name: ${fullName}`);
          
          const result = {
            status: 'success',
            instructorName: originalInstructorName,
            matchedName: fullName,
            rating: {
              overallRating: (exactMatch.avgRatingRounded !== null && exactMatch.avgRatingRounded !== undefined) ? Math.round(exactMatch.avgRatingRounded * 10) / 10 : 'N/A',
              difficulty: (exactMatch.avgDifficultyRounded !== null && exactMatch.avgDifficultyRounded !== undefined) ? Math.round(exactMatch.avgDifficultyRounded * 10) / 10 : 'N/A',
              wouldTakeAgainPercent: (exactMatch.wouldTakeAgainPercentRounded !== null && exactMatch.wouldTakeAgainPercentRounded !== undefined && exactMatch.wouldTakeAgainPercentRounded >= 0) ? Math.round(exactMatch.wouldTakeAgainPercentRounded) : 'N/A',
              numRatings: exactMatch.numRatings || 0,
              rmpUrl: `https://www.ratemyprofessors.com/professor/${exactMatch.legacyId}`
            }
          };
          
          console.log(`⚡ Skipping cache - returning fresh result for ${originalInstructorName}`);
          return result;
        }
      }
      
      // If exact match not found, fall back to fuzzy matching
      console.log(`🔍 Exact match not found, trying fuzzy match for: ${fullName}`);
      const closeMatch = results.find(professor => {
        const professorFullName = `${professor.firstName} ${professor.lastName}`;
        return this.calculateSimilarity(professorFullName.toLowerCase(), fullName.toLowerCase()) > 0.8;
      });
      
      if (closeMatch) {
        console.log(`🔍 Found close match for mapped name: ${fullName}`);
        const result = {
          status: 'success',
          instructorName: originalInstructorName,
          matchedName: `${closeMatch.firstName} ${closeMatch.lastName}`,
          rating: {
            overallRating: (closeMatch.avgRatingRounded !== null && closeMatch.avgRatingRounded !== undefined) ? Math.round(closeMatch.avgRatingRounded * 10) / 10 : 'N/A',
            difficulty: (closeMatch.avgDifficultyRounded !== null && closeMatch.avgDifficultyRounded !== undefined) ? Math.round(closeMatch.avgDifficultyRounded * 10) / 10 : 'N/A',
            wouldTakeAgainPercent: (closeMatch.wouldTakeAgainPercentRounded !== null && closeMatch.wouldTakeAgainPercentRounded !== undefined && closeMatch.wouldTakeAgainPercentRounded >= 0) ? Math.round(closeMatch.wouldTakeAgainPercentRounded) : 'N/A',
            numRatings: closeMatch.numRatings || 0,
            rmpUrl: `https://www.ratemyprofessors.com/professor/${closeMatch.legacyId}`
          }
        };
        return result;
      }
      
    } catch (error) {
      console.error(`Error searching for mapped name "${fullName}":`, error);
    }
    
    // If mapped name search fails, return no-profile
    return {
      status: 'no-profile',
      instructorName: originalInstructorName
    };
  }

  normalizeInstructorName(name) {
    // Convert "Last,First." format to "First Last" for RMP search
    // Handle patterns like "Simons,J." "Smith,A.B." "O'Connor,M." etc.
    const match = name.match(/([A-Za-z'.-]+),([A-Za-z.]+)\.?/);
    if (match) {
      const lastName = match[1];
      const firstInitials = match[2];
      
      // Clean up periods from initials for better processing
      const cleanInitials = firstInitials.replace(/\./g, '');
      
      console.log(`📝 Normalizing "${name}" → "${cleanInitials} ${lastName}"`);
      
      // Special handling for common cases where initials don't match
      // For "Lee,D." we need to ensure we search for "David Lee" not just "D Lee"
      if (cleanInitials.length === 1) {
        console.log(`📝 Single initial detected: "${cleanInitials}". Creating expanded search.`);
      }
      
      return `${cleanInitials} ${lastName}`;
    }
    
    console.log(`📝 No normalization needed for "${name}"`);
    return name;
  }

  createSearchStrings(nameComponents) {
    const firstName = nameComponents[0];
    const lastName = nameComponents[nameComponents.length - 1];
    
    let searchStrings = [];
    
    // Start with the most conservative searches first
    searchStrings.push(`${lastName} ${firstName}`);
    searchStrings.push(`${firstName} ${lastName}`);
    
    // If first name is an initial, add initial-based searches
    if (firstName.length <= 2) {
      // Search with just the initial
      searchStrings.push(`${lastName} ${firstName.charAt(0)}`);
      searchStrings.push(`${firstName.charAt(0)} ${lastName}`);
    }
    
    // Last name only (most permissive, will be filtered by initial matching)
    searchStrings.push(lastName);
    
    // Only for very specific cases where we know expansions work well,
    // add a few common names (but limit to top 2 to avoid false matches)
    if (firstName.length === 1 && ['D', 'J', 'M', 'R', 'S'].includes(firstName.toUpperCase())) {
      const commonNames = this.getTopNamesForInitial(firstName);
      console.log(`🔤 Adding limited expansion for "${firstName}":`, commonNames);
      
      for (const commonName of commonNames.slice(0, 2)) { // Only top 2
        searchStrings.push(`${commonName} ${lastName}`);
      }
    }
    
    console.log(`🔍 Created search strings for "${firstName} ${lastName}":`, searchStrings);
    return searchStrings;
  }

  getTopNamesForInitial(initial) {
    // Only the most common names to reduce false matches
    const topNames = {
      'D': ['David', 'Daniel'],
      'J': ['John', 'James'], 
      'M': ['Michael', 'Mark'],
      'R': ['Robert', 'Richard'],
      'S': ['Stephen', 'Steven']
    };
    
    return topNames[initial.toUpperCase()] || [];
  }



  getCommonNamesForInitial(initial) {
    const commonNames = {
      'A': ['Andrew', 'Alexander', 'Anthony', 'Adam', 'Aaron', 'Albert', 'Alan'],
      'B': ['Brian', 'Benjamin', 'Brad', 'Bruce', 'Brandon', 'Bill', 'Bob'],
      'C': ['Christopher', 'Charles', 'Craig', 'Christian', 'Chris', 'Carl'],
      'D': ['David', 'Daniel', 'Donald', 'Douglas', 'Dennis', 'Derek', 'Dean'],
      'E': ['Edward', 'Eric', 'Ethan', 'Eugene', 'Evan', 'Edwin', 'Earl'],
      'F': ['Frank', 'Frederick', 'Felix', 'Fernando', 'Francis', 'Fred'],
      'G': ['George', 'Gary', 'Gregory', 'Gerald', 'Glenn', 'Gordon', 'Grant'],
      'H': ['Henry', 'Harold', 'Howard', 'Hugh', 'Harry', 'Hans', 'Hector'],
      'I': ['Ian', 'Isaac', 'Ivan', 'Irwin', 'Irving', 'Ismael'],
      'J': ['John', 'James', 'Jason', 'Jeffrey', 'Jonathan', 'Joseph', 'Joshua'],
      'K': ['Kevin', 'Kenneth', 'Keith', 'Kyle', 'Karl', 'Kurt', 'Kane'],
      'L': ['Larry', 'Lawrence', 'Leonard', 'Louis', 'Luke', 'Luis', 'Lee'],
      'M': ['Michael', 'Mark', 'Matthew', 'Martin', 'Manuel', 'Marcus', 'Mario'],
      'N': ['Nicholas', 'Nathan', 'Neil', 'Norman', 'Nathaniel', 'Noah'],
      'O': ['Oscar', 'Oliver', 'Owen', 'Omar', 'Otis', 'Orlando'],
      'P': ['Paul', 'Peter', 'Patrick', 'Philip', 'Paul', 'Preston', 'Perry'],
      'Q': ['Quinton', 'Quentin', 'Quinn'],
      'R': ['Robert', 'Richard', 'Ronald', 'Roger', 'Ralph', 'Raymond', 'Ryan'],
      'S': ['Stephen', 'Steven', 'Scott', 'Samuel', 'Sean', 'Simon', 'Stuart'],
      'T': ['Thomas', 'Timothy', 'Tony', 'Terry', 'Todd', 'Travis', 'Tyler'],
      'U': ['Ulysses', 'Umberto', 'Uri'],
      'V': ['Victor', 'Vincent', 'Vernon', 'Vince', 'Virgil'],
      'W': ['William', 'Walter', 'Wayne', 'Warren', 'Wesley', 'Wade'],
      'X': ['Xavier', 'Xerxes'],
      'Y': ['Yves', 'York', 'Yale'],
      'Z': ['Zachary', 'Zane', 'Zack']
    };
    
    return commonNames[initial.toUpperCase()] || [];
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

  matchesWithInitial(professor, normalizedQuery) {
    // Handle cases like "D Lee" should match "David Lee" but not "Juhee Lee"
    const professorFullName = `${professor.firstName} ${professor.lastName}`.toLowerCase();
    const queryParts = normalizedQuery.toLowerCase().split(' ');
    const professorParts = professorFullName.split(' ');
    
    if (queryParts.length !== professorParts.length) {
      return false;
    }
    
    for (let i = 0; i < queryParts.length; i++) {
      const queryPart = queryParts[i];
      const professorPart = professorParts[i];
      
      // If query part is a single letter, check if it matches the first letter of professor part
      if (queryPart.length === 1) {
        if (professorPart.charAt(0) !== queryPart) {
          return false;
        }
      } else {
        // For multi-character parts, require exact match
        if (queryPart !== professorPart) {
          return false;
        }
      }
    }
    
    console.log(`✅ Initial match: "${normalizedQuery}" matches "${professorFullName}"`);
    return true;
  }

  calculateSimilarity(a, b) {
    // Calculate similarity ratio (0 to 1, where 1 is perfect match)
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(a, b);
    return (maxLength - distance) / maxLength;
  }

  levenshteinDistance(a, b) {
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

    return matrix[a.length][b.length];
  }

  isCloseEnough(a, b) {
    // Keep old function for backward compatibility, but make it stricter
    return this.calculateSimilarity(a, b) > 0.7;
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
