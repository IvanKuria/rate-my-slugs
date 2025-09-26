// UCSC Rate My Professors Background Service Worker
// Handles RMP API calls and caching

// Global variables
const UCSC_SCHOOL_ID = "U2Nob29sLTEwNzg="; // Base64 encoded 'School-1078'
const MAPPING_VERSION = "1.2"; // Increment when manual mappings change

// Initialize the background service
setupMessageHandlers();

// Setup message handlers
function setupMessageHandlers() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getProfessorRating") {
      handleProfessorRatingRequest(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    } else if (request.action === "clearCache") {
      handleClearCacheRequest(request, sender, sendResponse);
      return true;
    } else if (request.action === "refreshProfessor") {
      handleRefreshProfessorRequest(request, sender, sendResponse);
      return true;
    } else if (request.action === "testMapping") {
      handleTestMappingRequest(request, sender, sendResponse);
      return true;
    } else if (request.action === "getCacheStats") {
      handleCacheStatsRequest(request, sender, sendResponse);
      return true;
    }
  });
}

// Handle clear cache requests
async function handleClearCacheRequest(request, sender, sendResponse) {
  try {
    const clearedCount = await clearAllCache();
    sendResponse({
      status: "success",
      message: `Cleared ${clearedCount} cached entries`,
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    sendResponse({
      status: "error",
      error: error.message,
    });
  }
}

// Handle refresh professor requests
async function handleRefreshProfessorRequest(request, sender, sendResponse) {
  const { instructorName } = request;

  try {
    // Clear cache for this specific professor
    const cacheKey = `cache_${instructorName}`;
    await chrome.storage.local.remove(cacheKey);

    // Fetch fresh data
    const result = await fetchProfessorRating(instructorName);
    sendResponse(result);
  } catch (error) {
    console.error("Error refreshing professor:", error);
    sendResponse({
      status: "error",
      instructorName: instructorName,
      error: error.message,
    });
  }
}

// Handle cache stats requests
async function handleCacheStatsRequest(request, sender, sendResponse) {
  try {
    const stats = await getCacheStats();
    sendResponse({
      status: "success",
      stats: stats,
    });
  } catch (error) {
    console.error("Error getting cache stats:", error);
    sendResponse({
      status: "error",
      error: error.message,
    });
  }
}

// Handle test mapping requests
async function handleTestMappingRequest(request, sender, sendResponse) {
  try {
    // Check if manual mapping exists
    const mappedName = checkNameMapping(request.instructorName);

    if (mappedName) {
      // Test search using the mapped name
      const searchResults = await searchProfessor(mappedName);

      if (searchResults.length > 0) {
        const exactMatch = searchResults.find((professor) => {
          const professorFullName = `${professor.firstName} ${professor.lastName}`;
          return professorFullName.toLowerCase() === mappedName.toLowerCase();
        });

        if (exactMatch) {
          sendResponse({
            status: "success",
            mapping: `"${request.instructorName}" → "${mappedName}"`,
            found: true,
            professor: `${exactMatch.firstName} ${exactMatch.lastName}`,
            ratings: {
              overall: roundProfessorRating(exactMatch.avgRatingRounded),
              difficulty: roundProfessorRating(exactMatch.avgDifficultyRounded),
              wouldTakeAgain: roundWouldTakeAgainPercent(
                exactMatch.wouldTakeAgainPercentRounded
              ),
              numRatings: exactMatch.numRatings,
            },
          });
        } else {
          sendResponse({
            status: "mapping_exists_no_match",
            mapping: `"${request.instructorName}" → "${mappedName}"`,
            found: false,
            searchResultsCount: searchResults.length,
          });
        }
      } else {
        sendResponse({
          status: "mapping_exists_no_results",
          mapping: `"${request.instructorName}" → "${mappedName}"`,
          found: false,
        });
      }
    } else {
      sendResponse({
        status: "no_mapping",
        instructorName: request.instructorName,
        found: false,
      });
    }
  } catch (error) {
    console.error("Error testing mapping:", error);
    sendResponse({
      status: "error",
      instructorName: request.instructorName,
      error: error.message,
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
    console.error("Error handling professor rating request:", error);
    sendResponse({
      status: "error",
      instructorName: instructorName,
      error: error.message,
    });
  }
}

// Get cached rating
async function getCachedRating(instructorName) {
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
    const mappingChanged =
      !cachedData.mappingVersion ||
      cachedData.mappingVersion !== MAPPING_VERSION;

    // Check if this instructor now has a manual mapping but cache was from before mapping existed
    const hasNewMapping =
      checkNameMapping(instructorName) &&
      (!cachedData.mappingVersion || cachedData.data.status === "no-profile");

    if (isExpired || mappingChanged || hasNewMapping) {
      await chrome.storage.local.remove(cacheKey);
      return null;
    }

    return cachedData.data;
  } catch (error) {
    console.error("Error reading cache:", error);
    return null;
  }
}

// Set cached rating
async function setCachedRating(instructorName, data) {
  try {
    const cacheKey = `cache_${instructorName}`;
    await chrome.storage.local.set({
      [cacheKey]: {
        data: data,
        timestamp: Date.now(),
        version: "1.2",
        mappingVersion: MAPPING_VERSION,
      },
    });
  } catch (error) {
    console.error("Error caching rating:", error);
  }
}

// Clear all cache
async function clearAllCache() {
  try {
    const allData = await chrome.storage.local.get();
    const cacheKeys = Object.keys(allData).filter((key) =>
      key.startsWith("cache_")
    );

    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
      return cacheKeys.length;
    } else {
      return 0;
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
    return 0;
  }
}

// Get cache stats
async function getCacheStats() {
  try {
    const allData = await chrome.storage.local.get();
    const cacheKeys = Object.keys(allData).filter((key) =>
      key.startsWith("cache_")
    );
    const stats = {
      totalEntries: cacheKeys.length,
      totalSize: JSON.stringify(allData).length,
      entries: [],
    };

    for (const key of cacheKeys) {
      const instructorName = key.replace("cache_", "");
      const cached = allData[key];
      const ageHours = Math.round(
        (Date.now() - cached.timestamp) / (1000 * 60 * 60)
      );
      stats.entries.push({
        instructor: instructorName,
        ageHours: ageHours,
        hasData: !!cached.data,
      });
    }

    return stats;
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return { totalEntries: 0, totalSize: 0, entries: [] };
  }
}

// rounds overallDifficulty and difficulty
function roundProfessorRating(professorRating) {
  if (professorRating !== null && professorRating !== undefined) {
    const roundedProfessorRating = Math.round(professorRating * 10) / 10;
    return roundedProfessorRating;
  } else {
    return "N/A";
  }
}

function roundWouldTakeAgainPercent(percentage) {
  if (percentage !== null && percentage !== undefined && percentage >= 0) {
    const roundedPercentage = Math.round(percentage);
    return roundedPercentage;
  } else {
    return "N/A";
  }
}

// Fetch professor rating
async function fetchProfessorRating(instructorName, department = null) {
  try {
    // Check cache first
    const cachedRating = await getCachedRating(instructorName);
    if (cachedRating) {
      return cachedRating;
    }
    // Check manual name mapping first (highest priority)
    const mappedName = checkNameMapping(instructorName);
    if (mappedName) {
      return await searchByExactName(mappedName, instructorName);
    }

    // Normalize instructor name for search
    const normalizedName = normalizeInstructorName(instructorName);

    // Create multiple search strings
    const nameComponents = normalizedName
      .split(" ")
      .map((part) => part.toLowerCase().trim());
    const searchStrings = createSearchStrings(nameComponents);

    // Try multiple search variations
    let searchResult = [];
    for (const searchString of searchStrings) {
      const results = await searchProfessor(searchString);
      if (results.length > 0) {
        // If department is provided, filter by department context first
        let filteredResults = results;
        if (department) {
          const departmentMatches = filterByDepartmentContext(
            results,
            department
          );
          if (departmentMatches.length > 0) {
            filteredResults = departmentMatches;
          }
        }

        // First, try to find exact matches
        const exactMatches = filteredResults.filter((professor) => {
          const fullName = `${professor.firstName} ${professor.lastName}`;
          return fullName.toLowerCase() === normalizedName.toLowerCase();
        });

        if (exactMatches.length > 0) {
          searchResult = exactMatches;
          break;
        }

        // If no exact match, try initial-based matching (more strict for single letters)
        const initialMatches = filteredResults.filter((professor) => {
          return matchesWithInitial(professor, normalizedName);
        });

        if (initialMatches.length > 0) {
          // Prefer professors with department context if available
          if (department) {
            const deptMatches = filterByDepartmentContext(
              initialMatches,
              department
            );
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
        status: "no-profile",
        instructorName: instructorName,
      };
      // Cache the successful result
      await setCachedRating(instructorName, result);
      return result;
    }

    // Get detailed rating for the first match
    const professor = searchResult[0];
    const professorFullName = `${professor.firstName} ${professor.lastName}`;

    const result = {
      status: "success",
      instructorName: instructorName,
      matchedName: professorFullName,
      rating: {
        overallRating: roundProfessorRating(professor.avgRatingRounded),
        difficulty: roundProfessorRating(professor.avgDifficultyRounded),
        wouldTakeAgainPercent: roundWouldTakeAgainPercent(
          professor.wouldTakeAgainPercentRounded
        ),
        numRatings: professor.numRatings || 0,
        rmpUrl: `https://www.ratemyprofessors.com/professor/${professor.legacyId}`,
      },
    };

    // Cache the successful result
    await setCachedRating(instructorName, result);
    return result;
  } catch (error) {
    console.error("Error fetching professor rating:", error);
    return {
      status: "error",
      instructorName: instructorName,
      error: error.message,
    };
  }
}

// Check name mapping
function checkNameMapping(instructorName) {
  // Manual mapping dictionary: UCSC name → RMP name OR RMP ID
  // IMPORTANT: When adding new mappings, increment MAPPING_VERSION in constructor to auto-clear old cache
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
    "LeBron,M": "Marisol LeBrón",

    // page 5 - none
    // page 6
    "Renau Ardevol,J": "Jose Renau",
    "Garrick-Bethell,I": "Ian Garrick-Bethell",
    "McGuire,S": "Steve Mcguire",
    // page 7
    "Kim,G": "Kim Gueyon",
    "Gallagher-Geurtsen,T": "Tricia Gallagher-Geurtsen",
    "Kissell,R": "Rene Espinoza-Kissell",
    // page 8
    "Ocampo-Penuela,N.": "Natalia Ocampo-Penuela",
    "Turk-Kubo,K": "Kendra Turk-Kubo",
    "Rizzo-Martinez,M.": "Martin Rizzo",
    // page 9
    "Stein-Rosen,G.": "Galia Stein-Rosen",
    "Majzler,R.D.": "Bob Majzler",
    "DeGarmo,E.L": "Erica Degarmo",
    "Sanders-Self,M.L": "Melissa Sanders-Self",
    "Cruz,M": "Isabel Cruz",
    // page 10
    "Aladro Font,J": "Jordi Aladro-Font",
    // page 11
    "Escobar Vega,L": "Laura Escobar",
    "Silva,K.G": "Katie Silva-Chavez",
    "McGuinness,A": "Aims McGuinness",
    // page 12
  };

  return nameMapping[instructorName] || null;
}

// Search by exact name
async function searchByExactName(fullName, originalInstructorName) {
  try {
    // Search using the exact full name
    const results = await searchProfessor(fullName);

    if (results.length > 0) {
      // Find the best match (should be exact since we have the full name)
      const exactMatch = results.find((professor) => {
        const professorFullName = `${professor.firstName} ${professor.lastName}`;
        return professorFullName.toLowerCase() === fullName.toLowerCase();
      });

      if (exactMatch) {
        const result = {
          status: "success",
          instructorName: originalInstructorName,
          matchedName: fullName,
          rating: {
            overallRating: roundProfessorRating(exactMatch.avgRatingRounded),
            difficulty: roundProfessorRating(exactMatch.avgDifficultyRounded),
            wouldTakeAgainPercent: roundWouldTakeAgainPercent(
              exactMatch.wouldTakeAgainPercentRounded
            ),
            numRatings: exactMatch.numRatings || 0,
            rmpUrl: `https://www.ratemyprofessors.com/professor/${exactMatch.legacyId}`,
          },
        };

        // Cache the successful result
        await setCachedRating(originalInstructorName, result);
        return result;
      }
    }

    // If exact match not found, fall back to simple matching
    const closeMatch = results.find((professor) => {
      const professorFullName = `${professor.firstName} ${professor.lastName}`;
      return simpleNameMatch(professorFullName, fullName);
    });

    if (closeMatch) {
      const result = {
        status: "success",
        instructorName: originalInstructorName,
        matchedName: `${closeMatch.firstName} ${closeMatch.lastName}`,
        rating: {
          overallRating: roundProfessorRating(closeMatch.avgRatingRounded),
          difficulty: roundProfessorRating(closeMatch.avgDifficultyRounded),
          wouldTakeAgainPercent: roundWouldTakeAgainPercent(
            closeMatch.wouldTakeAgainPercentRounded
          ),
          numRatings: closeMatch.numRatings || 0,
          rmpUrl: `https://www.ratemyprofessors.com/professor/${closeMatch.legacyId}`,
        },
      };
      return result;
    }
  } catch (error) {
    console.error(`Error searching for mapped name "${fullName}":`, error);
  }

  // If mapped name search fails, return no-profile
  return {
    status: "no-profile",
    instructorName: originalInstructorName,
  };
}

// Normalize instructor name
function normalizeInstructorName(name) {
  // Convert "Last,First." format to "First Last" for RMP search
  // Handle patterns like "Simons,J." "Smith,A.B." "O'Connor,M." etc.
  const match = name.match(/([A-Za-z'.-]+),([A-Za-z.]+)\.?/);
  if (match) {
    const lastName = match[1];
    const firstInitials = match[2];

    // Clean up periods from initials for better processing
    const cleanInitials = firstInitials.replace(/\./g, "");

    return `${cleanInitials} ${lastName}`;
  }

  return name;
}

// Create search strings
function createSearchStrings(nameComponents) {
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
  if (
    firstName.length === 1 &&
    ["D", "J", "M", "R", "S"].includes(firstName.toUpperCase())
  ) {
    const commonNames = getTopNamesForInitial(firstName);

    for (const commonName of commonNames.slice(0, 2)) {
      // Only top 2
      searchStrings.push(`${commonName} ${lastName}`);
    }
  }

  return searchStrings;
}

// Get top names for initial
function getTopNamesForInitial(initial) {
  // Only the most common names to reduce false matches
  const topNames = {
    D: ["David", "Daniel"],
    J: ["John", "James"],
    M: ["Michael", "Mark"],
    R: ["Robert", "Richard"],
    S: ["Stephen", "Steven"],
  };

  return topNames[initial.toUpperCase()] || [];
}

// Rounds overallDifficulty and difficulty
function roundProfessorRating(professorRating) {
  if (professorRating !== null && professorRating !== undefined) {
    let roundedProfessorRating = Math.round(professorRating * 10) / 10;
    return roundedProfessorRating;
  } else {
    return "N/A";
  }
}

function roundWouldTakeAgainPercent(percentage) {
  if (percentage !== null && percentage !== undefined && percentage >= 0) {
    let roundedPercentage = Math.round(percentage);
    return roundedPercentage;
  } else {
    return "N/A";
  }
}

// Filter by department context
function filterByDepartmentContext(professors, department) {
  // Map UCSC departments to related RMP course subjects/tags
  const departmentMappings = {
    AM: ["applied mathematics", "mathematics", "math", "applied math"],
    ECON: ["economics", "econ", "business"],
    PHYS: ["physics", "physical science"],
    CHEM: ["chemistry", "chemical"],
    BIOL: ["biology", "biological", "life science"],
    PSYC: ["psychology", "psych"],
    HIST: ["history", "historical"],
    ENGL: ["english", "literature", "writing"],
    CMPS: ["computer science", "programming", "computing"],
    MATH: ["mathematics", "math", "calculus", "algebra"],
    ART: ["art", "arts", "visual arts"],
    MUS: ["music", "musical"],
    THEA: ["theater", "theatre", "drama"],
    POLI: ["political science", "politics", "government"],
    ANTH: ["anthropology", "cultural"],
    SOCY: ["sociology", "social science"],
  };

  const relatedTerms = departmentMappings[department] || [
    department.toLowerCase(),
  ];

  // Filter professors whose teaching tags or reviews mention related terms
  return professors.filter((professor) => {
    // Check rating tags
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
  // Handle cases like "D Lee" should match "David Lee" but not "Juhee Lee"
  const professorFullName =
    `${professor.firstName} ${professor.lastName}`.toLowerCase();
  const queryParts = normalizedQuery.toLowerCase().split(" ");
  const professorParts = professorFullName.split(" ");

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

  return true;
}

// Simple name match
function simpleNameMatch(professorName, queryName) {
  // Simple matching: same last name and first initial
  const prof = professorName.toLowerCase().trim();
  const query = queryName.toLowerCase().trim();

  const profParts = prof.split(" ");
  const queryParts = query.split(" ");

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
    schoolID: UCSC_SCHOOL_ID,
  };

  const body = JSON.stringify({
    query,
    variables: {
      query: queryVars,
    },
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch("https://www.ratemyprofessors.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Basic dGVzdDp0ZXN0",
      },
      body: body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `GraphQL errors: ${data.errors.map((e) => e.message).join(", ")}`
      );
    }

    // Extract professors from GraphQL response
    if (
      data.data &&
      data.data.newSearch &&
      data.data.newSearch.teachers &&
      data.data.newSearch.teachers.edges
    ) {
      const professors = data.data.newSearch.teachers.edges.map(
        (edge) => edge.node
      );
      return professors;
    }

    return [];
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    } else {
      console.error("RMP API fetch error:", error);
      throw error;
    }
  }
}
