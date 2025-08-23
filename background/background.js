// UCSC Rate My Professors Background Service Worker
// Handles RMP API calls and caching

class RMPBackgroundService {
  constructor() {
    this.UCSC_SCHOOL_ID = 'U2Nob29sLTEwNzg='; // Base64 encoded 'School-1078'
    this.MAPPING_VERSION = '1.2'; // Increment when manual mappings change
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
    } else if (request.action === 'clearCache') {
      this.handleClearCacheRequest(request, sender, sendResponse);
      return true;
    } else if (request.action === 'getCacheStats') {
      this.handleCacheStatsRequest(request, sender, sendResponse);
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
      const cacheKey = `cache_${instructorName}`;
      await chrome.storage.local.remove(cacheKey);
      
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

  async handleClearCacheRequest(request, sender, sendResponse) {
    try {
      const clearedCount = await this.clearAllCache();
      sendResponse({
        status: 'success',
        message: `Cleared ${clearedCount} cached entries`
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      sendResponse({
        status: 'error',
        error: error.message
      });
    }
  }

  async handleCacheStatsRequest(request, sender, sendResponse) {
    try {
      const stats = await this.getCacheStats();
      sendResponse({
        status: 'success',
        stats: stats
      });
    } catch (error) {
      console.error('Error getting cache stats:', error);
      sendResponse({
        status: 'error',
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
        const cacheTTL = 30 * 24 * 60 * 60 * 1000; // 30 days
        
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

  async getCachedRating(instructorName) {
    try {
      const cacheKey = `cache_${instructorName}`;
      const result = await chrome.storage.local.get(cacheKey);
      const cachedData = result[cacheKey];
      
      if (!cachedData) {
        return null;
      }
      
      // Check if cache is expired (30 days)
      const ttl = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      const isExpired = Date.now() - cachedData.timestamp > ttl;
      
      // Check if mapping version has changed (invalidate cache for new mappings)
      const mappingChanged = !cachedData.mappingVersion || cachedData.mappingVersion !== this.MAPPING_VERSION;
      
      // Check if this instructor now has a manual mapping but cache was from before mapping existed
      const hasNewMapping = this.checkNameMapping(instructorName) && 
                           (!cachedData.mappingVersion || cachedData.data.status === 'no-profile');
      
      if (isExpired || mappingChanged || hasNewMapping) {
        await chrome.storage.local.remove(cacheKey);
        return null;
      }
      
      return cachedData.data;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }

  async setCachedRating(instructorName, data) {
    try {
      const cacheKey = `cache_${instructorName}`;
      await chrome.storage.local.set({
        [cacheKey]: {
          data: data,
          timestamp: Date.now(),
          version: '1.0',
          mappingVersion: this.MAPPING_VERSION
        }
      });
    } catch (error) {
      console.error('Error caching rating:', error);
    }
  }

  async clearAllCache() {
    try {
      const allData = await chrome.storage.local.get();
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith('cache_'));
      
      if (cacheKeys.length > 0) {
        await chrome.storage.local.remove(cacheKeys);
        return cacheKeys.length;
      } else {
        return 0;
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      return 0;
    }
  }

  async getCacheStats() {
    try {
      const allData = await chrome.storage.local.get();
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith('cache_'));
      const stats = {
        totalEntries: cacheKeys.length,
        totalSize: JSON.stringify(allData).length,
        entries: []
      };
      
      for (const key of cacheKeys) {
        const instructorName = key.replace('cache_', '');
        const cached = allData[key];
        const ageHours = Math.round((Date.now() - cached.timestamp) / (1000 * 60 * 60));
        stats.entries.push({
          instructor: instructorName,
          ageHours: ageHours,
          hasData: !!cached.data
        });
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalEntries: 0, totalSize: 0, entries: [] };
    }
  }

  async fetchProfessorRating(instructorName, department = null) {
    console.log(`Fetching rating for ${instructorName} (Department: ${department})`);
    

    
    try {
      // Check cache first
      const cachedRating = await this.getCachedRating(instructorName);
      if (cachedRating) {
        return cachedRating;
      }
      // Check manual name mapping first (highest priority)
      const mappedName = this.checkNameMapping(instructorName);
      if (mappedName) {

        return await this.searchByExactName(mappedName, instructorName);
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
          // If department is provided, filter by department context first
          let filteredResults = results;
          if (department) {
            const departmentMatches = this.filterByDepartmentContext(results, department);
            if (departmentMatches.length > 0) {
              filteredResults = departmentMatches;
            }
          }
          
          // First, try to find exact matches
          const exactMatches = filteredResults.filter(professor => {
            const fullName = `${professor.firstName} ${professor.lastName}`;
            return fullName.toLowerCase() === normalizedName.toLowerCase();
          });
          
          if (exactMatches.length > 0) {
            searchResult = exactMatches;
            break;
          }
          
          // If no exact match, try initial-based matching (more strict for single letters)
          const initialMatches = filteredResults.filter(professor => {
            return this.matchesWithInitial(professor, normalizedName);
          });
          
          if (initialMatches.length > 0) {
            // Prefer professors with department context if available
            if (department) {
              const deptMatches = this.filterByDepartmentContext(initialMatches, department);
              if (deptMatches.length > 0) {
                searchResult = deptMatches;
              } else {
                searchResult = initialMatches;
              }
            } else {
              searchResult = initialMatches;
            }
            break;
          }
          
          // If still no matches, try simple name matches (same last name + first initial)
          const closeMatches = filteredResults.filter(professor => {
            const fullName = `${professor.firstName} ${professor.lastName}`;
            return this.simpleNameMatch(fullName, normalizedName);
          });
          
          if (closeMatches.length > 0) {
            searchResult = closeMatches;
            break;
          }
        }
      }
      
      if (!searchResult || searchResult.length === 0) {
        const result = {
          status: 'no-profile',
          instructorName: instructorName
        };
                  // Cache the successful result
          await this.setCachedRating(instructorName, result);
          return result;
      }



      // Get detailed rating for the first match
      const professor = searchResult[0];
      const professorFullName = `${professor.firstName} ${professor.lastName}`;
      

      
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

      // Cache the successful result
      await this.setCachedRating(instructorName, result);
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
    // ⚠️  IMPORTANT: When adding new mappings, increment MAPPING_VERSION in constructor to auto-clear old cache
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
      "Simons,J.": "Julie Simons",
      "Fehren-Schmitz,L.": "Lars Fehren-Schmitz",
      // page 1
      "Ramirez-Ruiz,E.J.": "Enrico Ramirez-Ruiz",
      "Stone,C.M.": "Michael Stone",
      "Rodriguez-Montero,P.": "Pamela Rodriguez-Montero",
      "Ballard,P.": "Patrick Ballard",
      "brice,m.": "Mattie Brice",
      // page 2
      "Heady,K.K.": "Kristen Kusic-Heady",
      "Morozova,O.": "Olena Morozova Vaske",
      "Corbett-Detig,R.": "Russell Corbett-Detig",
      "Haussler,D.": "David Haussler",
      "Green,R.E.": "Richard Ed Green",
      "Eroy-Reveles,A.A.": "Aura Eroy-Reveles",
      "Binder,C.M.": "Caitlin Binder",
      "Wu,T.": "Ting Ting Wu",
      "Chatziafratis,E.": "Vaggos Chatziafratis",
      // page 3 - rememeber to add the guy here

      // page 4
      "Wardrip-Fruin,N.": "Noah Wardrip-Fruin",
      "Marisol LeBron": "Marisol LeBrón"

      




      

      
      
      // Example of direct ID mapping (more reliable):
      // "Smith,J.": "ID:2367890",
      
      // Add more mappings as discovered:
      // "Professor,X.": "Full Name on RMP",
    };
    
    return nameMapping[instructorName] || null;
  }

  async searchByExactName(fullName, originalInstructorName) {
    console.log(`🎯 Searching for exact mapped name: "${fullName}"`);
    

    
    try {
      // Search using the exact full name
      const results = await this.searchProfessor(fullName);
      

      
      if (results.length > 0) {
        // Find the best match (should be exact since we have the full name)
        const exactMatch = results.find(professor => {
          const professorFullName = `${professor.firstName} ${professor.lastName}`;
          return professorFullName.toLowerCase() === fullName.toLowerCase();
        });
        
        if (exactMatch) {
          
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
        
          // Cache the successful result
          await this.setCachedRating(originalInstructorName, result);
          return result;
        }
      }
      
      // If exact match not found, fall back to simple matching
      const closeMatch = results.find(professor => {
        const professorFullName = `${professor.firstName} ${professor.lastName}`;
        return this.simpleNameMatch(professorFullName, fullName);
      });
      
      if (closeMatch) {
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

  simpleNameMatch(professorName, queryName) {
    // Simple matching: same last name and first initial
    const prof = professorName.toLowerCase().trim();
    const query = queryName.toLowerCase().trim();
    
    const profParts = prof.split(' ');
    const queryParts = query.split(' ');
    
    // Need at least first and last name for both
    if (profParts.length < 2 || queryParts.length < 2) {
      return false;
    }
    
    // Compare last names (exact match required)
    const profLast = profParts[profParts.length - 1];
    const queryLast = queryParts[queryParts.length - 1];
    
    if (profLast !== queryLast) {
      return false;
    }
    
    // Compare first initials
    const profFirst = profParts[0][0];
    const queryFirst = queryParts[0][0];
    
    const matches = profFirst === queryFirst;
    
    if (matches) {
      console.log(`✅ Simple match: "${queryName}" matches "${professorName}" (same last name + first initial)`);
    }
    
    return matches;
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
