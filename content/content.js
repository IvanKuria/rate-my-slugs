// UCSC Rate My Professors Content Script
// Finds course rows and injects RMP ratings

// Global variables
let processedRows = new Set();
let cache = new Map();
let debounceTimer = null;

// Initialize the extension
init();

// Initialize the extension
function init() {
  // Add global functions for manual testing
  setupGlobalFunctions();

  // Keep functions available by re-adding them periodically since URL doesn't change
  setInterval(() => {
    setupGlobalFunctions();
  }, 3000); // Re-add every 3 seconds

  // Wait for course results to load before processing
  waitForCourseResults();
  setupMutationObserver();
}

// Setup global debug functions
function setupGlobalFunctions() {
  window.ucscRMPDebug = function () {
    return processExistingRows();
  };

  window.ucscRMPCheck = function () {
    return checkForCourseResults();
  };

  window.ucscRMPForceSearch = function () {
    const allDivs = document.querySelectorAll("div");

    // Look for any divs containing instructor-like text
    const courseDivs = Array.from(allDivs).filter((div) => {
      const text = div.textContent || "";
      return (
        text.includes("Instructor:") ||
        text.includes("Credits:") ||
        /[A-Z][a-z]+,[A-Z]\.?/.test(text)
      );
    });

    return courseDivs;
  };

  window.ucscRMPRefresh = function (instructorName) {
    chrome.runtime.sendMessage(
      {
        action: "refreshProfessor",
        instructorName: instructorName,
      },
      (response) => {
        // Reload the page to see updated data
        window.location.reload();
      }
    );
  };

  window.ucscRMPTestMapping = function (name) {
    chrome.runtime
      .sendMessage({
        action: "testMapping",
        instructorName: name,
      })
      .then((result) => {
        console.log("Test result:", result);
      });
  };

  window.ucscRMPClearCache = function () {
    chrome.runtime
      .sendMessage({
        action: "clearCache",
      })
      .then((result) => {
        console.log("Cache cleared:", result);
      });
  };

  window.ucscRMPCacheStats = function () {
    chrome.runtime
      .sendMessage({
        action: "getCacheStats",
      })
      .then((result) => {
        if (result.status === "success") {
          console.log("Cache stats:", result.stats);
        }
      });
  };

  window.ucscRMPInspectCache = function () {
    chrome.storage.local.get(null, (items) => {
      console.log("Chrome storage contents:", items);
    });
  };
}

// Wait for course results to load
function waitForCourseResults() {
  // Check if we're on the enrollment page or the iframe with course results
  const isMainEnrollmentPage = window.location.href.includes("ADMN_ENROLLMENT");
  const isIframePage = window.location.href.includes("pisa.ucsc.edu");

  if (!isMainEnrollmentPage && !isIframePage) {
    return;
  }

  // Check if course results are already loaded
  const hasResults = checkForCourseResults();
  if (hasResults) {
    processExistingRows();
    return;
  }

  // Set up interval to watch for course results to appear
  let attempts = 0;
  const maxAttempts = 30; // Increased attempts since results may take time to load

  const checkInterval = setInterval(() => {
    attempts++;

    const hasResults = checkForCourseResults();
    if (hasResults) {
      processExistingRows();
      clearInterval(checkInterval);
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
    }
  }, 1000); // Check every 1 second
}

// Check for course results
function checkForCourseResults() {
  // Look for indicators that course results have loaded
  const indicators = [
    "div.panel.panel-default.row", // Bootstrap course rows
    '[id*="rowpanel_"]', // Row panel IDs
    'div[class*="panel-default"][class*="row"]', // Alternative panel structure
    ".search-results", // Generic results container
    '[class*="course"]', // Any course-related classes
    "table", // Tables (common in iframe results)
    "tr", // Table rows
    'form[name*="search"]', // Search forms
    '[class*="result"]', // Result containers
  ];

  for (const indicator of indicators) {
    const elements = document.querySelectorAll(indicator);
    if (elements.length > 0) {
      return true;
    }
  }

  // Also check for text content that suggests results are loaded
  const pageText = document.body.textContent.toLowerCase();
  const resultKeywords = ["instructor:", "credits:", "section:", "enroll"];
  const hasResultKeywords = resultKeywords.some((keyword) =>
    pageText.includes(keyword)
  );

  return hasResultKeywords;
}

// Setup mutation observer
function setupMutationObserver() {
  // Watch for DOM changes (pagination, filters, etc.)
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for any course-related additions
            const courseIndicators = [
              "div.panel.panel-default.row",
              '[class*="panel"]',
              '[class*="course"]',
              '[id*="rowpanel"]',
            ];

            for (const indicator of courseIndicators) {
              if (
                (node.matches && node.matches(indicator)) ||
                (node.querySelector && node.querySelector(indicator))
              ) {
                shouldProcess = true;
                break;
              }
            }
          }
        });
      }
    });

    if (shouldProcess) {
      debounceProcess();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
  });
}

// Debounce processing
function debounceProcess() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    processExistingRows();
  }, 500);
}

// Process existing rows
function processExistingRows() {
  // Use the correct Bootstrap selectors from the HTML
  const courseRowSelectors = [
    "div.panel.panel-default.row", // Main course rows
    ".panel.panel-default.row", // Alternative
    'div[class*="panel"][class*="row"]', // More flexible
    '[id*="rowpanel_"]', // Specific row panel IDs
  ];

  let courseRows = [];
  let usedSelector = "";

  for (const selector of courseRowSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      courseRows = elements;
      usedSelector = selector;
      break;
    }
  }

  if (courseRows.length === 0) {
    return 0;
  }

  courseRows.forEach((row, index) => {
    if (processedRows.has(row)) {
      return; // Already processed
    }

    const instructorName = extractInstructorName(row);
    if (instructorName && instructorName !== "STAFF/TBA") {
      // Extract course department for context
      const department = extractCourseDepartment(row);

      processInstructor(row, instructorName, department);
      processedRows.add(row);
    }
  });

  return courseRows.length;
}

// Extract course department
function extractCourseDepartment(row) {
  // Look for course title/department in the row
  // Course titles are usually in format "AM 11B - 01 Math Methods Econ II"
  const titleElements = row.querySelectorAll(
    'h3, h2, .course-title, [class*="title"]'
  );

  for (const element of titleElements) {
    const text = element.textContent.trim();
    // Match patterns like "AM 11B", "ECON 100A", "PHYS 5A", etc.
    const deptMatch = text.match(/([A-Z]{2,5})\s+\d+[A-Z]?/);
    if (deptMatch) {
      return deptMatch[1];
    }
  }

  // Also check all text content for department patterns
  const departmentRowText = row.textContent;
  const deptMatch = departmentRowText.match(/([A-Z]{2,5})\s+\d+[A-Z]?/);
  if (deptMatch) {
    return deptMatch[1];
  }

  return null;
}

// Extract course code
function extractCourseCode(row) {
  // Look for course code in the row (e.g., "101", "11B", "100A")
  const titleElements = row.querySelectorAll(
    'h3, h2, .course-title, [class*="title"]'
  );

  for (const element of titleElements) {
    const text = element.textContent.trim();
    // Match patterns like "AM 11B", "ECON 100A", "PHYS 5A", etc.
    const codeMatch = text.match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
    if (codeMatch) {
      return codeMatch[2];
    }
  }

  // Also check all text content for course code patterns
  const rowText = row.textContent;
  const codeMatch = rowText.match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
  if (codeMatch) {
    return codeMatch[2];
  }

  return null;
}

// Extract instructor name
function extractInstructorName(row) {
  // First, check if this row contains any manually mapped instructor names
  // This bypasses parsing issues for complex names
  const manualMappingNames = [
    "Berrahmoun,A.",
    "Hibbert-Jones,W.D.",
    "Hernandez Garavito,C.",
    "Mascarenhas Menna Barreto,J.",
    "Simons,J.",
    "Fehren-Schmitz,L.",
    "Shange-Binion,S.T.",
    "Ramirez-Ruiz,E.J.",
    "Kilpatrick,A.M.",
    "Stone,C.M.",
    "Rodriguez-Montero,P.",
    "Ballard,P.",
    "brice,m.",
    "Heady,K.K.",
    "Morozova,O.",
    "Corbett-Detig,R.",
    "Haussler,D.",
    "Green,R.E.",
    "Eroy-Reveles,A.A.",
    "Binder,C.M.",
    "Wu,T.",
    "Chatziafratis,E.",
    "Wardrip-Fruin,N.",
    "LeBron,M",
    "Renau Ardevol,J",
    "Garrick-Bethell,I",
    "McGuire,S",
    "Kim,G",
    "Gallagher-Geurtsen,T",
    "Kissell,R",
    "Ocampo-Penuela,N.",
    "Turk-Kubo,K",
    "Rizzo-Martinez,M.",
    "Stein-Rosen,G.",
    "Majzler,R.D",
    "DeGarmo,E.L",
    "Sanders-Self,M.L",
    "Cruz,M",
    "Aladro Font,J",
    "Escobar Vega,L",
    "Silva,K.G",
    "McGuinness,A",
    "Alexandradinata,A.",
    "Martinez-Galarce,M.A.",
    "Fox Tree,J.E.",
    "McNamara,M.B.",
    "Mc Kay,S.",
    "Castillo Trelles,C",
    "Alfaro Cordoba,M.",
    "McCourt,A.M.",
    "Nuila-Chae,S.L.",
    "Carney-Waddy,S.A.",
    "Garrecht-Williams,C.K.",
    "Madeline Lane",
    "WouldGo,T.",
  ];

  const rowText = row.textContent || row.innerText || "";
  for (const mappedName of manualMappingNames) {
    if (rowText.includes(mappedName)) {
      return mappedName;
    }
  }

  // Look for instructor information in Bootstrap column elements
  const instructorElements = row.querySelectorAll("div.col-xs-6.col-sm-3");

  for (const element of instructorElements) {
    const text = element.textContent.trim();

    // Check if this element contains instructor information
    if (text.includes("Instructor:") || text.includes("Professor:")) {
      // Extract instructor name using patterns
      const namePatterns = [
        /([A-Z][a-z-]+,[A-Z]\.?)/g, // "Fehren-Schmitz,L." or "Simons,J."
        /([A-Z][a-z-]+,\s*[A-Z]\.?)/g, // "Fehren-Schmitz, L." or "Simons, J."
        /([A-Z][A-Z-]+,[A-Z]\.?)/g, // "FEHREN-SCHMITZ,L." or "SMITH,J."
      ];

      for (const pattern of namePatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          const validNames = matches.filter((name) => {
            const lowerName = name.toLowerCase();
            return (
              !lowerName.includes("staff") &&
              !lowerName.includes("tba") &&
              name.length > 3
            );
          });

          if (validNames.length > 0) {
            return validNames[0];
          }
        }
      }
    }
  }

  // Fallback: search entire row text for instructor names
  const namePatterns = [
    /([A-Z][a-z-]+,[A-Z]\.?)/g, // "Fehren-Schmitz,L." or "Simons,J."
    /([A-Z][a-z-]+,\s*[A-Z]\.?)/g, // "Fehren-Schmitz, L." or "Simons, J."
  ];

  for (const pattern of namePatterns) {
    const matches = rowText.match(pattern);
    if (matches && matches.length > 0) {
      const validNames = matches.filter((name) => {
        const lowerName = name.toLowerCase();
        return (
          !lowerName.includes("staff") &&
          !lowerName.includes("tba") &&
          !lowerName.includes("time") &&
          !lowerName.includes("location") &&
          name.length > 3
        );
      });

      if (validNames.length > 0) {
        return validNames[0];
      }
    }
  }

  return null;
}

// Process instructor
async function processInstructor(row, instructorName, department = null) {
  // Check if we already have a rating card
  if (row.querySelector(".rmp-rating-card")) {
    return;
  }

  // Create loading card
  const loadingCard = createRatingCard("loading", instructorName);
  row.appendChild(loadingCard);

  try {
    // Get RMP data
    const rmpData = await fetchRMPRating(instructorName, department);

    // Update card with RMP data
    updateRatingCard(loadingCard, rmpData);
  } catch (error) {
    console.error("Error getting professor data:", error);
    updateRatingCard(loadingCard, { status: "error" });
  }
}

// Fetch RMP rating
async function fetchRMPRating(instructorName, department) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getProfessorRating",
      instructorName: instructorName,
      department: department,
    });
    return response;
  } catch (error) {
    console.error("Error fetching RMP rating:", error);
    return null;
  }
}

// Create rating card
function createRatingCard(status, instructorName) {
  const card = document.createElement("div");
  card.className = "rmp-rating-card";
  card.dataset.instructor = instructorName;
  card.dataset.status = status;

  const content = document.createElement("div");
  content.className = "rmp-content";

  switch (status) {
    case "loading":
      content.innerHTML = `<span class="rmp-loading">Rate My Professor: Loading...</span>`;
      break;
    case "success":
      content.innerHTML = `<span class="rmp-inline">Rate My Professor: <span class="rmp-values">Loading data...</span></span>`;
      break;
    case "error":
      content.innerHTML = `<span class="rmp-error">Rate My Professor: Unable to load ratings</span>`;
      break;
    case "no-profile":
      content.innerHTML = `<span class="rmp-no-profile">Rate My Professor: No ratings found</span>`;
      break;
  }

  card.appendChild(content);
  return card;
}

// Update rating card
function updateRatingCard(card, rmpData) {
  const content = card.querySelector(".rmp-content");
  card.dataset.status = rmpData?.status || "loading"; // Use rmpData status

  if (rmpData?.status === "success" && rmpData.rating) {
    const rating = rmpData.rating;

    // Generate banana slug display for rating
    const slugCount = Math.floor(rating.overallRating);
    const fraction = rating.overallRating - slugCount;
    const slugUrl = chrome.runtime.getURL("icons/sammy/slug.png");
    let slugs = "";

    for (let i = 0; i < 5; i++) {
      if (i < slugCount) {
        // full slug
        slugs += `
          <span class="slug-wrapper">
            <img src="${slugUrl}" class="slug-icon slug-empty" alt="slug empty">
            <img src="${slugUrl}" class="slug-icon slug-fill" style="clip-path: inset(0 0 0 0);" alt="slug full">
          </span>`;
      } else if (i === slugCount && fraction > 0) {
        // fractional slug
        const percent = Math.round(fraction * 100);
        slugs += `
          <span class="slug-wrapper">
            <img src="${slugUrl}" class="slug-icon slug-empty" alt="slug empty">
            <img src="${slugUrl}" class="slug-icon slug-fill" style="clip-path: inset(0 ${
100 - percent
}% 0 0);" alt="slug partial">
          </span>`;
      } else {
        // empty slug
        slugs += `
          <span class="slug-wrapper">
            <img src="${slugUrl}" class="slug-icon slug-empty" alt="slug empty">
          </span>`;
      }
    }

    // Determine color class for overall rating u(higher = better = greener)
    const getRatingColorClass = (value) => {
      if (value >= 4.5) return "rmp-rating-excellent";
      if (value >= 4.0) return "rmp-rating-good";
      if (value >= 3.0) return "rmp-rating-average";
      if (value >= 2.0) return "rmp-rating-poor";
      return "rmp-rating-bad";
    };

    // Determine color class for difficulty (higher = harder = redder)
    const getDifficultyColorClass = (value) => {
      if (value >= 4.5) return "rmp-difficulty-very-hard";
      if (value >= 4.0) return "rmp-difficulty-hard";
      if (value >= 3.0) return "rmp-difficulty-average";
      if (value >= 2.0) return "rmp-difficulty-moderate";
      return "rmp-difficulty-easy";
    };

    const ratingClass = getRatingColorClass(rating.overallRating);
    const difficultyClass = getDifficultyColorClass(rating.difficulty);

    content.innerHTML = `
      <span class="rmp-inline">
        <span class="rmp-label">Quality Rating:</span>
        <span class="rmp-rating-value ${ratingClass}"><span class="rmp-slugs">${slugs}</span> ${rating.overallRating}/5</span>
        <span class="rmp-rating-value">Difficulty: <span class="${difficultyClass}">${rating.difficulty}/5</span></span>
                   <span class="rmp-take-again">${rating.wouldTakeAgainPercent}%</span>
        <span class="rmp-rating-value">would take again</span>
        <span class="rmp-review-value">(${rating.numRatings} reviews)</span>
        <a href="${rating.rmpUrl}" target="_blank" class="rmp-link">👤 View Profile</a>
      </span>
    `;
  } else if (rmpData?.status === "no-profile") {
    content.innerHTML = `<span class="rmp-no-profile">Rate My Professors: No ratings found</span>`;
  } else if (rmpData?.status === "error") {
    content.innerHTML = `<span class="rmp-error">Rate My Professors: Unable to load ratings</span>`;
  }
}
