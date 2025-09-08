// UCSC Rate My Professors Content Script
// Finds course rows and injects RMP ratings

// Global variables
let processedRows = new Set();
let cache = new Map();
let debounceTimer = null;

// Initialize the extension
console.log("🎓 UCSC RMP Extension loaded");
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
    console.log("🔧 Manual debug trigger");
    return processExistingRows();
  };

  window.ucscRMPCheck = function () {
    console.log("🔧 Manual results check");
    return checkForCourseResults();
  };

  window.ucscRMPForceSearch = function () {
    console.log("🔧 Force searching for course elements");
    const allDivs = document.querySelectorAll("div");
    console.log(`Found ${allDivs.length} div elements total`);

    // Look for any divs containing instructor-like text
    const courseDivs = Array.from(allDivs).filter((div) => {
      const text = div.textContent || "";
      return (
        text.includes("Instructor:") ||
        text.includes("Credits:") ||
        /[A-Z][a-z]+,[A-Z]\.?/.test(text)
      );
    });

    console.log(`Found ${courseDivs.length} divs with course-like content`);
    courseDivs.forEach((div, idx) => {
      if (idx < 3) {
        console.log(`Course Div ${idx + 1}:`, {
          tag: div.tagName,
          className: div.className,
          id: div.id,
          text: div.textContent.substring(0, 100),
        });
      }
    });

    return courseDivs;
  };

  window.ucscRMPRefresh = function (instructorName) {
    console.log(`🔄 Refreshing data for: ${instructorName}`);
    chrome.runtime.sendMessage(
      {
        action: "refreshProfessor",
        instructorName: instructorName,
      },
      (response) => {
        console.log("Refresh response:", response);
        // Reload the page to see updated data
        window.location.reload();
      }
    );
  };

  window.ucscRMPTestMapping = function (name) {
    console.log(`🧪 Testing mapping for: "${name}"`);
    chrome.runtime
      .sendMessage({
        action: "testMapping",
        instructorName: name,
      })
      .then((result) => {
        console.log(`🧪 Test result:`, result);
      });
  };

  window.ucscRMPClearCache = function () {
    console.log(`🗑️ Clearing all cached ratings...`);
    chrome.runtime
      .sendMessage({
        action: "clearCache",
      })
      .then((result) => {
        console.log(`🗑️ Cache cleared:`, result);
      });
  };

  window.ucscRMPCacheStats = function () {
    console.log(`📊 Getting cache statistics...`);
    chrome.runtime
      .sendMessage({
        action: "getCacheStats",
      })
      .then((result) => {
        if (result.status === "success") {
          console.log(`📊 Cache Stats:`, result.stats);
          console.log(`📦 Total entries: ${result.stats.totalEntries}`);
          console.log(`💾 Total size: ${result.stats.totalSize} bytes`);
          if (result.stats.entries.length > 0) {
            console.log(`📋 Cached professors:`, result.stats.entries);
          }
        }
      });
  };

  window.ucscRMPInspectCache = function () {
    console.log("🔍 Inspecting cache...");
    chrome.storage.local.get(null, (items) => {
      console.log("Chrome storage contents:", items);
      const keys = Object.keys(items);
      if (keys.length === 0) {
        console.log("📭 Cache is empty");
      } else {
        console.log(`📦 Found ${keys.length} cached items:`);
        keys.forEach((key) => {
          console.log(`  - ${key}:`, items[key]);
        });
      }
    });
  };

  console.log("🔧 Debug functions available:");
  console.log("   ucscRMPDebug() - trigger normal processing");
  console.log("   ucscRMPCheck() - check if results detected");
  console.log("   ucscRMPForceSearch() - force search for course elements");
  console.log('   ucscRMPRefresh("LastName,F.") - refresh specific professor');
  console.log("   ucscRMPClearCache() - clear all cached data");
  console.log("   ucscRMPInspectCache() - see what is currently cached");
}

// Wait for course results to load
function waitForCourseResults() {
  // Check if we're on the enrollment page or the iframe with course results
  const isMainEnrollmentPage = window.location.href.includes("ADMN_ENROLLMENT");
  const isIframePage = window.location.href.includes("pisa.ucsc.edu");

  if (!isMainEnrollmentPage && !isIframePage) {
    console.log("📍 Not on enrollment page or iframe, skipping");
    return;
  }

  if (isIframePage) {
    console.log("📍 On iframe page - this is where course results should be!");
  }

  console.log("📍 On enrollment page, checking for course results...");

  // Check if course results are already loaded
  const hasResults = checkForCourseResults();
  if (hasResults) {
    console.log("✅ Course results already loaded, processing immediately");
    processExistingRows();
    return;
  }

  // Set up interval to watch for course results to appear
  let attempts = 0;
  const maxAttempts = 30; // Increased attempts since results may take time to load

  const checkInterval = setInterval(() => {
    attempts++;
    console.log(
      `🔄 Waiting for course results (attempt ${attempts}/${maxAttempts})`
    );

    const hasResults = checkForCourseResults();
    if (hasResults) {
      console.log("✅ Course results detected! Processing rows...");
      const foundRows = processExistingRows();
      console.log(`🛑 Stopping check - found ${foundRows} course rows`);
      clearInterval(checkInterval);
    } else if (attempts >= maxAttempts) {
      console.log(
        "🛑 Stopping check - max attempts reached without finding course results"
      );
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
      console.log(
        `📊 Course results indicator found: '${indicator}' (${elements.length} elements)`
      );
      return true;
    }
  }

  // Also check for text content that suggests results are loaded
  const pageText = document.body.textContent.toLowerCase();
  const resultKeywords = ["instructor:", "credits:", "section:", "enroll"];
  const hasResultKeywords = resultKeywords.some((keyword) =>
    pageText.includes(keyword)
  );

  if (hasResultKeywords) {
    console.log("📊 Course results detected by keywords");
    return true;
  }

  return false;
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
            console.log(
              "🔄 DOM change detected:",
              node.tagName,
              node.className
            );

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
                console.log(`✅ Course-related element detected: ${indicator}`);
                shouldProcess = true;
                break;
              }
            }
          }
        });
      }
    });

    if (shouldProcess) {
      console.log(
        "🔄 DOM changes suggest course results loaded, processing..."
      );
      debounceProcess();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
  });

  console.log("👁️ MutationObserver set up to watch for DOM changes");
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
    console.log(
      `🔍 Trying selector '${selector}': found ${elements.length} elements`
    );

    if (elements.length > 0) {
      courseRows = elements;
      usedSelector = selector;
      console.log(`✅ Using selector: ${selector} (${elements.length} rows)`);
      break;
    }
  }

  if (courseRows.length === 0) {
    console.log("❌ No course rows found with any selector");
    // Try to find any divs that might be course rows
    const allPanels = document.querySelectorAll('div[class*="panel"]');
    const allRows = document.querySelectorAll('div[class*="row"]');
    console.log(
      `🔍 Found ${allPanels.length} panel elements and ${allRows.length} row elements on page`
    );

    // Debug: show what the panel elements actually look like
    if (allPanels.length > 0) {
      console.log("📋 Sample panel elements:");
      allPanels.forEach((panel, index) => {
        if (index < 5) {
          // Show first 5
          console.log(
            `Panel ${index + 1}:`,
            panel.className,
            "|",
            panel.textContent.substring(0, 100)
          );
        }
      });
    }

    // Let's try to find ANY elements that might contain course information
    console.log("🔍 Searching for ANY elements that might be course rows...");

    // Search for elements containing instructor-like text
    const allElements = document.querySelectorAll("*");
    const potentialCourseElements = [];

    allElements.forEach((el) => {
      const text = el.textContent || "";
      // More comprehensive search patterns
      if (
        text.includes("Instructor:") ||
        text.includes("Credits:") ||
        text.includes("Section:") ||
        text.includes("Enroll") ||
        text.includes("Units:") ||
        text.includes("Class:") ||
        text.includes("Component:") ||
        /[A-Z][a-z]+,[A-Z]\.?/.test(text) || // Name pattern like "Simons,J."
        /\b[A-Z]{2,4}\s*\d{1,3}[A-Z]?\b/.test(text) || // Course codes like "CMPS 101"
        /\d{4}\s*-\s*\d{2}\s*-\s*\d{2}/.test(text) || // Dates
        /\d+\s*Units/.test(text)
      ) {
        // Units text
        potentialCourseElements.push(el);
      }
    });

    console.log(
      `🎯 Found ${potentialCourseElements.length} elements with course-like content`
    );

    if (potentialCourseElements.length > 0) {
      console.log("📋 Sample course-like elements:");
      potentialCourseElements.slice(0, 5).forEach((el, idx) => {
        console.log(`Course Element ${idx + 1}:`);
        console.log(`  Tag: ${el.tagName}`);
        console.log(`  Class: ${el.className}`);
        console.log(`  ID: ${el.id}`);
        console.log(`  Text: ${el.textContent.substring(0, 100)}...`);
        console.log(
          `  Parent: ${el.parentElement?.tagName}.${el.parentElement?.className}`
        );
        console.log("---");
      });
    }

    // Also check for common table/grid structures
    const tableSelectors = [
      "table tr",
      "tbody tr",
      '[role="row"]',
      '[role="gridcell"]',
      "tr",
      "td",
    ];

    console.log("🔍 Checking for table/grid structures:");
    tableSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      console.log(`  ${selector}: ${elements.length} elements`);
    });

    return 0;
  }

  // Debug: Show ALL extracted instructor names first
  console.log(
    `🚨 DEBUG: Extracting ALL instructor names from ${courseRows.length} rows:`
  );
  courseRows.forEach((row, index) => {
    const name = extractInstructorName(row);
    if (name) {
      console.log(`  Row ${index + 1}: "${name}"`);
      if (name.toLowerCase().includes("simons")) {
        console.log(`    🚨 FOUND SIMONS IN ROW ${index + 1}!`);
      }
    }
  });

  courseRows.forEach((row, index) => {
    console.log(`📋 Processing row ${index + 1}:`, row);

    if (processedRows.has(row)) {
      console.log(`⏭️ Row ${index + 1} already processed, skipping`);
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
      console.log(`🏫 Found department from title: ${deptMatch[1]}`);
      return deptMatch[1];
    }
  }

  // Also check all text content for department patterns
  const departmentRowText = row.textContent;
  const deptMatch = departmentRowText.match(/([A-Z]{2,5})\s+\d+[A-Z]?/);
  if (deptMatch) {
    console.log(`🏫 Found department from row text: ${deptMatch[1]}`);
    return deptMatch[1];
  }

  console.log(`🏫 No department found in row`);
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
      console.log(`📚 Found course code: ${codeMatch[2]}`);
      return codeMatch[2];
    }
  }

  // Also check all text content for course code patterns
  const rowText = row.textContent;
  const codeMatch = rowText.match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
  if (codeMatch) {
    console.log(`📚 Found course code from row text: ${codeMatch[2]}`);
    return codeMatch[2];
  }

  console.log(`📚 No course code found in row`);
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
  ];

  const rowText = row.textContent || row.innerText || "";
  for (const mappedName of manualMappingNames) {
    if (rowText.includes(mappedName)) {
      console.log(
        `🎯 Found manually mapped instructor: ${mappedName} (bypassing parsing)`
      );
      return mappedName;
    }
  }

  // Look for instructor information in Bootstrap column elements
  const instructorElements = row.querySelectorAll("div.col-xs-6.col-sm-3");
  console.log(
    `🔍 Found ${instructorElements.length} Bootstrap column elements`
  );

  for (const element of instructorElements) {
    const text = element.textContent.trim();
    console.log(`📝 Checking column element: "${text}"`);

    // Check if this element contains instructor information
    if (text.includes("Instructor:") || text.includes("Professor:")) {
      console.log("✅ Found instructor-related column!");

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
            console.log(`👨‍🏫 Extracted instructor name: ${validNames[0]}`);
            return validNames[0];
          }
        }
      }
    }
  }

  // Fallback: search entire row text for instructor names
  console.log(
    `📝 Fallback: searching entire row text: "${rowText.substring(0, 100)}..."`
  );

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
        console.log(`👨‍🏫 Found instructor name in row text: ${validNames[0]}`);
        return validNames[0];
      }
    }
  }

  console.log("❌ No instructor name found in row");
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
    // Extract course info for grade data lookup
    const courseDept = extractCourseDepartment(row);
    const courseCode = extractCourseCode(row);
    const fullClassName =
      courseDept && courseCode ? `${courseDept} ${courseCode}` : null;

    console.log(
      `📤 Fetching data for: ${instructorName} (Department: ${department}, Class: ${fullClassName})`
    );

    // First get RMP data to get the matchedName
    const rmpData = await fetchRMPRating(instructorName, department);

    // Then get grade data using the matchedName from RMP results
    let gradeData = null;
    if (
      rmpData &&
      rmpData.status === "success" &&
      rmpData.matchedName &&
      fullClassName
    ) {
      gradeData = await fetchGradeData(rmpData.matchedName, fullClassName);
    }

    console.log(`📥 Received data:`, { rmpData, gradeData });

    // Update card with both datasets
    updateRatingCard(loadingCard, rmpData, gradeData);
  } catch (error) {
    console.error("Error getting professor data:", error);
    updateRatingCard(loadingCard, { status: "error" }, null);
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

// Fetch grade data
async function fetchGradeData(matchedName, className) {
  if (!className || !matchedName) {
    console.log(
      "📊 No class name or matched name available for grade data lookup"
    );
    return null;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: "getGradeData",
      matchedName: matchedName,
      className: className,
    });

    // Check if response exists and has the expected structure
    if (response && response.gradeData !== undefined) {
      return response.gradeData;
    } else {
      console.log("📊 No grade data found for:", matchedName, className);
      return null;
    }
  } catch (error) {
    console.error("Error fetching grade data:", error);
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
function updateRatingCard(card, rmpData, gradeData) {
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
    const slugStisticsURL = "https://slugtistics.com/";

    content.innerHTML = `
      <span class="rmp-inline">
        <span class="rmp-label">Quality Rating:</span>
        <span class="rmp-rating-value ${ratingClass}"><span class="rmp-slugs">${slugs}</span> ${rating.overallRating}/5</span>
        <span class="rmp-rating-value">Difficulty: <span class="${difficultyClass}">${rating.difficulty}/5</span></span>
                   <span class="rmp-take-again">${rating.wouldTakeAgainPercent}%</span>
        <span class="rmp-rating-value">would take again</span>
        <span class="rmp-review-value">(${rating.numRatings} reviews)</span>
        <a href="${rating.rmpUrl}" target="_blank" class="rmp-link">👤 View Profile</a>
        <a href="${slugStisticsURL}" target="_blank" class="rmp-link">📶 View Grade Distr</a>
      </span>
    `;
  } else if (rmpData?.status === "no-profile") {
    content.innerHTML = `<span class="rmp-no-profile">Rate My Professors: No ratings found</span>`;
  } else if (rmpData?.status === "error") {
    content.innerHTML = `<span class="rmp-error">Rate My Professors: Unable to load ratings</span>`;
  }

  // Add grade data display if available
  if (gradeData) {
    const gradeSection = createGradeSection(gradeData);
    content.appendChild(gradeSection);
  }
}

// Create grade section
function createGradeSection(gradeData) {
  const gradeSection = document.createElement("div");
  gradeSection.className = "rmp-grade-data";

  gradeSection.innerHTML = `
    <div class="grade-header">📊 Class Performance</div>
    <div class="grade-stats">
      <span class="grade-gpa">${gradeData.gpa} GPA</span>
      <span class="grade-students">${gradeData.students} students</span>
      <span class="grade-quarters">${gradeData.quarters} quarters</span>
    </div>
  `;

  return gradeSection;
}
