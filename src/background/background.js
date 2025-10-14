// UCSC Rate My Professors Background Service Worker
// Handles RMP API calls and caching

const UCSC_SCHOOL_ID = 'U2Nob29sLTEwNzg='; // Base64 encoded 'School-1078'
const MAPPING_VERSION = '1.2';

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    getProfessorRating: handleProfessorRatingRequest,
    clearCache: handleClearCacheRequest,
    refreshProfessor: handleRefreshProfessorRequest,
    testMapping: handleTestMappingRequest,
    getCacheStats: handleCacheStatsRequest
  };

  const handler = handlers[request.action];
  if (handler) {
    handler(request, sender, sendResponse);
    return true; // Keep message channel open for async response
  }
});

// Handle clear cache requests
async function handleClearCacheRequest(request, sender, sendResponse) {
  try {
    const clearedCount = await clearAllCache();
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

// Handle refresh professor requests
async function handleRefreshProfessorRequest(request, sender, sendResponse) {
  const { instructorName } = request;

  try {
    const cacheKey = `cache_${instructorName}`;
    await chrome.storage.local.remove(cacheKey);

    const result = await fetchProfessorRating(instructorName);
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

// Handle cache stats requests
async function handleCacheStatsRequest(request, sender, sendResponse) {
  try {
    const stats = await getCacheStats();
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

// Handle test mapping requests
async function handleTestMappingRequest(request, sender, sendResponse) {
  try {
    const mappedName = checkNameMapping(request.instructorName);

    if (mappedName) {
      const searchResults = await searchProfessor(mappedName);

      if (searchResults.length > 0) {
        const exactMatch = searchResults.find((professor) => {
          const professorFullName = `${professor.firstName} ${professor.lastName}`;
          return professorFullName.toLowerCase() === mappedName.toLowerCase();
        });

        if (exactMatch) {
          sendResponse({
            status: 'success',
            mapping: `"${request.instructorName}" → "${mappedName}"`,
            found: true,
            professor: `${exactMatch.firstName} ${exactMatch.lastName}`,
            ratings: {
              overall: roundProfessorRating(exactMatch.avgRatingRounded),
              difficulty: roundProfessorRating(exactMatch.avgDifficultyRounded),
              wouldTakeAgain: roundWouldTakeAgainPercent(
                exactMatch.wouldTakeAgainPercentRounded
              ),
              numRatings: exactMatch.numRatings
            }
          });
        } else {
          sendResponse({
            status: 'mapping_exists_no_match',
            mapping: `"${request.instructorName}" → "${mappedName}"`,
            found: false,
            searchResultsCount: searchResults.length
          });
        }
      } else {
        sendResponse({
          status: 'mapping_exists_no_results',
          mapping: `"${request.instructorName}" → "${mappedName}"`,
          found: false
        });
      }
    } else {
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

// Handle professor rating requests
async function handleProfessorRatingRequest(request, sender, sendResponse) {
  const { instructorName, department } = request;

  try {
    const result = await fetchProfessorRating(instructorName, department);
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

// Cache functions
async function getCachedRating(instructorName) {
  try {
    const cacheKey = `cache_${instructorName}`;
    const result = await chrome.storage.local.get(cacheKey);
    const cachedData = result[cacheKey];

    if (!cachedData) {
      return null;
    }

    const ttl = 30 * 24 * 60 * 60 * 1000; // 30 days
    const isExpired = Date.now() - cachedData.timestamp > ttl;

    const mappingChanged =
      !cachedData.mappingVersion || cachedData.mappingVersion !== MAPPING_VERSION;

    const hasNewMapping =
      checkNameMapping(instructorName) &&
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

async function setCachedRating(instructorName, data) {
  try {
    const cacheKey = `cache_${instructorName}`;
    await chrome.storage.local.set({
      [cacheKey]: {
        data: data,
        timestamp: Date.now(),
        version: '1.2',
        mappingVersion: MAPPING_VERSION
      }
    });
  } catch (error) {
    console.error('Error caching rating:', error);
  }
}

async function clearAllCache() {
  try {
    const allData = await chrome.storage.local.get();
    const cacheKeys = Object.keys(allData).filter((key) => key.startsWith('cache_'));

    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
      return cacheKeys.length;
    }
    return 0;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return 0;
  }
}

async function getCacheStats() {
  try {
    const allData = await chrome.storage.local.get();
    const cacheKeys = Object.keys(allData).filter((key) => key.startsWith('cache_'));
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

// Utility functions
function roundProfessorRating(professorRating) {
  if (professorRating !== null && professorRating !== undefined) {
    return Math.round(professorRating * 10) / 10;
  }
  return 'N/A';
}

function roundWouldTakeAgainPercent(percentage) {
  if (percentage !== null && percentage !== undefined && percentage >= 0) {
    return Math.round(percentage);
  }
  return 'N/A';
}

// Fetch professor rating
async function fetchProfessorRating(instructorName, department = null) {
  try {
    const cachedRating = await getCachedRating(instructorName);
    if (cachedRating) {
      return cachedRating;
    }

    const mappedName = checkNameMapping(instructorName);
    if (mappedName) {
      return await searchByExactName(mappedName, instructorName);
    }

    const normalizedName = normalizeInstructorName(instructorName);
    const nameComponents = normalizedName.split(' ').map((part) => part.toLowerCase().trim());
    const searchStrings = createSearchStrings(nameComponents);

    let searchResult = [];
    for (const searchString of searchStrings) {
      const results = await searchProfessor(searchString);
      if (results.length > 0) {
        let filteredResults = results;
        if (department) {
          const departmentMatches = filterByDepartmentContext(results, department);
          if (departmentMatches.length > 0) {
            filteredResults = departmentMatches;
          }
        }

        const exactMatches = filteredResults.filter((professor) => {
          const fullName = `${professor.firstName} ${professor.lastName}`;
          return fullName.toLowerCase() === normalizedName.toLowerCase();
        });

        if (exactMatches.length > 0) {
          searchResult = exactMatches;
          break;
        }

        const initialMatches = filteredResults.filter((professor) =>
          matchesWithInitial(professor, normalizedName)
        );

        if (initialMatches.length > 0) {
          if (department) {
            const deptMatches = filterByDepartmentContext(initialMatches, department);
            searchResult = deptMatches.length > 0 ? deptMatches : initialMatches;
          } else {
            searchResult = initialMatches;
          }
          break;
        }

        const closeMatches = filteredResults.filter((professor) => {
          const fullName = `${professor.firstName} ${professor.lastName}`;
          return simpleNameMatch(fullName, normalizedName);
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
      await setCachedRating(instructorName, result);
      return result;
    }

    const professor = searchResult[0];
    const professorFullName = `${professor.firstName} ${professor.lastName}`;

    const result = {
      status: 'success',
      instructorName: instructorName,
      matchedName: professorFullName,
      rating: {
        overallRating: roundProfessorRating(professor.avgRatingRounded),
        difficulty: roundProfessorRating(professor.avgDifficultyRounded),
        wouldTakeAgainPercent: roundWouldTakeAgainPercent(
          professor.wouldTakeAgainPercentRounded
        ),
        numRatings: professor.numRatings || 0,
        rmpUrl: `https://www.ratemyprofessors.com/professor/${professor.legacyId}`
      }
    };

    await setCachedRating(instructorName, result);
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

// Name mapping
function checkNameMapping(instructorName) {
  const nameMapping = {
    'Berrahmoun,A.': 'Abdelkader Berrahmoun',
    'Hibbert-Jones,W.D.': 'Dee Hibbert-Jones',
    'Hernandez Garavito,C.': 'Carla Hernandez Garavito',
    'Mascarenhas Menna Barreto,J.': 'Jorge Barreto',
    'Shange-Binion,S.T.': 'Savannah Shange',
    'Kilpatrick,A.M.': 'Marm Kilpatrick',
    'Simons,J.': 'Julie Simons',
    'Fehren-Schmitz,L.': 'Lars Fehren-Schmitz',
    'Ramirez-Ruiz,E.J.': 'Enrico Ramirez-Ruiz',
    'Stone,C.M.': 'Michael Stone',
    'Rodriguez-Montero,P.': 'Pamela Rodriguez-Montero',
    'Ballard,P.': 'Patrick Ballard',
    'brice,m.': 'Mattie Brice',
    'Heady,K.K.': 'Kristen Kusic-Heady',
    'Morozova,O.': 'Olena Morozova Vaske',
    'Corbett-Detig,R.': 'Russell Corbett-Detig',
    'Haussler,D.': 'David Haussler',
    'Green,R.E.': 'Richard Ed Green',
    'Eroy-Reveles,A.A.': 'Aura Eroy-Reveles',
    'Binder,C.M.': 'Caitlin Binder',
    'Wu,T.': 'Ting Ting Wu',
    'Chatziafratis,E.': 'Vaggos Chatziafratis',
    'Wardrip-Fruin,N.': 'Noah Wardrip-Fruin',
    'LeBron,M': 'Marisol LeBrón',
    'Renau Ardevol,J': 'Jose Renau',
    'Garrick-Bethell,I': 'Ian Garrick-Bethell',
    'McGuire,S': 'Steve Mcguire',
    'Kim,G': 'Kim Gueyon',
    'Gallagher-Geurtsen,T': 'Tricia Gallagher-Geurtsen',
    'Kissell,R': 'Rene Espinoza-Kissell',
    'Ocampo-Penuela,N.': 'Natalia Ocampo-Penuela',
    'Turk-Kubo,K': 'Kendra Turk-Kubo',
    'Rizzo-Martinez,M.': 'Martin Rizzo',
    'Stein-Rosen,G.': 'Galia Stein-Rosen',
    'Majzler,R.D.': 'Bob Majzler',
    'DeGarmo,E.L': 'Erica Degarmo',
    'Sanders-Self,M.L': 'Melissa Sanders-Self',
    'Cruz,M': 'Isabel Cruz',
    'Aladro Font,J': 'Jordi Aladro-Font',
    'Escobar Vega,L': 'Laura Escobar',
    'Silva,K.G': 'Katie Silva-Chavez',
    'McGuinness,A': 'Aims McGuinness'
  };

  return nameMapping[instructorName] || null;
}

// Search by exact name
async function searchByExactName(fullName, originalInstructorName) {
  try {
    const results = await searchProfessor(fullName);

    if (results.length > 0) {
      const exactMatch = results.find((professor) => {
        const professorFullName = `${professor.firstName} ${professor.lastName}`;
        return professorFullName.toLowerCase() === fullName.toLowerCase();
      });

      if (exactMatch) {
        const result = {
          status: 'success',
          instructorName: originalInstructorName,
          matchedName: fullName,
          rating: {
            overallRating: roundProfessorRating(exactMatch.avgRatingRounded),
            difficulty: roundProfessorRating(exactMatch.avgDifficultyRounded),
            wouldTakeAgainPercent: roundWouldTakeAgainPercent(
              exactMatch.wouldTakeAgainPercentRounded
            ),
            numRatings: exactMatch.numRatings || 0,
            rmpUrl: `https://www.ratemyprofessors.com/professor/${exactMatch.legacyId}`
          }
        };

        await setCachedRating(originalInstructorName, result);
        return result;
      }
    }

    const closeMatch = results.find((professor) => {
      const professorFullName = `${professor.firstName} ${professor.lastName}`;
      return simpleNameMatch(professorFullName, fullName);
    });

    if (closeMatch) {
      const result = {
        status: 'success',
        instructorName: originalInstructorName,
        matchedName: `${closeMatch.firstName} ${closeMatch.lastName}`,
        rating: {
          overallRating: roundProfessorRating(closeMatch.avgRatingRounded),
          difficulty: roundProfessorRating(closeMatch.avgDifficultyRounded),
          wouldTakeAgainPercent: roundWouldTakeAgainPercent(
            closeMatch.wouldTakeAgainPercentRounded
          ),
          numRatings: closeMatch.numRatings || 0,
          rmpUrl: `https://www.ratemyprofessors.com/professor/${closeMatch.legacyId}`
        }
      };
      return result;
    }
  } catch (error) {
    console.error(`Error searching for mapped name "${fullName}":`, error);
  }

  return {
    status: 'no-profile',
    instructorName: originalInstructorName
  };
}

// Normalize instructor name
function normalizeInstructorName(name) {
  const match = name.match(/([A-Za-z'.-]+),([A-Za-z.]+)\.?/);
  if (match) {
    const lastName = match[1];
    const firstInitials = match[2];
    const cleanInitials = firstInitials.replace(/\./g, '');
    return `${cleanInitials} ${lastName}`;
  }
  return name;
}

// Create search strings
function createSearchStrings(nameComponents) {
  const firstName = nameComponents[0];
  const lastName = nameComponents[nameComponents.length - 1];

  const searchStrings = [];

  searchStrings.push(`${lastName} ${firstName}`);
  searchStrings.push(`${firstName} ${lastName}`);

  if (firstName.length <= 2) {
    searchStrings.push(`${lastName} ${firstName.charAt(0)}`);
    searchStrings.push(`${firstName.charAt(0)} ${lastName}`);
  }

  searchStrings.push(lastName);

  if (firstName.length === 1 && ['D', 'J', 'M', 'R', 'S'].includes(firstName.toUpperCase())) {
    const commonNames = getTopNamesForInitial(firstName);
    for (const commonName of commonNames.slice(0, 2)) {
      searchStrings.push(`${commonName} ${lastName}`);
    }
  }

  return searchStrings;
}

function getTopNamesForInitial(initial) {
  const topNames = {
    D: ['David', 'Daniel'],
    J: ['John', 'James'],
    M: ['Michael', 'Mark'],
    R: ['Robert', 'Richard'],
    S: ['Stephen', 'Steven']
  };

  return topNames[initial.toUpperCase()] || [];
}

// Filter by department context
function filterByDepartmentContext(professors, department) {
  const departmentMappings = {
    AM: ['applied mathematics', 'mathematics', 'math', 'applied math'],
    ECON: ['economics', 'econ', 'business'],
    PHYS: ['physics', 'physical science'],
    CHEM: ['chemistry', 'chemical'],
    BIOL: ['biology', 'biological', 'life science'],
    PSYC: ['psychology', 'psych'],
    HIST: ['history', 'historical'],
    ENGL: ['english', 'literature', 'writing'],
    CMPS: ['computer science', 'programming', 'computing'],
    MATH: ['mathematics', 'math', 'calculus', 'algebra'],
    ART: ['art', 'arts', 'visual arts'],
    MUS: ['music', 'musical'],
    THEA: ['theater', 'theatre', 'drama'],
    POLI: ['political science', 'politics', 'government'],
    ANTH: ['anthropology', 'cultural'],
    SOCY: ['sociology', 'social science']
  };

  const relatedTerms = departmentMappings[department] || [department.toLowerCase()];

  return professors.filter((professor) => {
    if (professor.teacherRatingTags) {
      for (const tag of professor.teacherRatingTags) {
        if (tag.tagName) {
          const tagName = tag.tagName.toLowerCase();
          if (relatedTerms.some((term) => tagName.includes(term))) {
            return true;
          }
        }
      }
    }
    return false;
  });
}

// Check if names match with initial
function matchesWithInitial(professor, normalizedQuery) {
  const professorFullName = `${professor.firstName} ${professor.lastName}`.toLowerCase();
  const queryParts = normalizedQuery.toLowerCase().split(' ');
  const professorParts = professorFullName.split(' ');

  if (queryParts.length !== professorParts.length) {
    return false;
  }

  for (let i = 0; i < queryParts.length; i++) {
    const queryPart = queryParts[i];
    const professorPart = professorParts[i];

    if (queryPart.length === 1) {
      if (professorPart.charAt(0) !== queryPart) {
        return false;
      }
    } else {
      if (queryPart !== professorPart) {
        return false;
      }
    }
  }

  return true;
}

// Simple name match
function simpleNameMatch(professorName, queryName) {
  const prof = professorName.toLowerCase().trim();
  const query = queryName.toLowerCase().trim();

  const profParts = prof.split(' ');
  const queryParts = query.split(' ');

  if (profParts.length < 2 || queryParts.length < 2) {
    return false;
  }

  const profLast = profParts[profParts.length - 1];
  const queryLast = queryParts[queryParts.length - 1];

  if (profLast !== queryLast) {
    return false;
  }

  const profFirst = profParts[0][0];
  const queryFirst = queryParts[0][0];

  return profFirst === queryFirst;
}

// Search professor
async function searchProfessor(name) {
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
    schoolID: UCSC_SCHOOL_ID
  };

  const body = JSON.stringify({
    query,
    variables: {
      query: queryVars
    }
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://www.ratemyprofessors.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Basic dGVzdDp0ZXN0'
      },
      body: body,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${data.errors.map((e) => e.message).join(', ')}`);
    }

    if (
      data.data &&
      data.data.newSearch &&
      data.data.newSearch.teachers &&
      data.data.newSearch.teachers.edges
    ) {
      return data.data.newSearch.teachers.edges.map((edge) => edge.node);
    }

    return [];
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    console.error('RMP API fetch error:', error);
    throw error;
  }
}

