import { createRoot } from 'react-dom/client';
import RatingCard from '../components/RatingCard';

// Global variables
let processedRows = new Set();
let debounceTimer = null;

// Initialize the extension
export function initializeContentScript() {
  // Add global functions for manual testing
  setupGlobalFunctions();

  // Keep functions available by re-adding them periodically
  setInterval(() => {
    setupGlobalFunctions();
  }, 3000);

  // Wait for course results to load before processing
  waitForCourseResults();
  setupMutationObserver();
}

// Setup global debug functions
function setupGlobalFunctions() {
  window.ucscRMPDebug = () => processExistingRows();
  window.ucscRMPCheck = () => checkForCourseResults();

  window.ucscRMPForceSearch = () => {
    const allDivs = document.querySelectorAll('div');
    const courseDivs = Array.from(allDivs).filter((div) => {
      const text = div.textContent || '';
      return (
        text.includes('Instructor:') ||
        text.includes('Credits:') ||
        /[A-Z][a-z]+,[A-Z]\.?/.test(text)
      );
    });
    return courseDivs;
  };

  window.ucscRMPRefresh = (instructorName) => {
    chrome.runtime.sendMessage(
      {
        action: 'refreshProfessor',
        instructorName: instructorName
      },
      () => {
        window.location.reload();
      }
    );
  };

  window.ucscRMPTestMapping = (name) => {
    chrome.runtime
      .sendMessage({
        action: 'testMapping',
        instructorName: name
      })
      .then((result) => {
        console.log('Test result:', result);
      });
  };

  window.ucscRMPClearCache = () => {
    chrome.runtime
      .sendMessage({
        action: 'clearCache'
      })
      .then((result) => {
        console.log('Cache cleared:', result);
      });
  };

  window.ucscRMPCacheStats = () => {
    chrome.runtime
      .sendMessage({
        action: 'getCacheStats'
      })
      .then((result) => {
        if (result.status === 'success') {
          console.log('Cache stats:', result.stats);
        }
      });
  };

  window.ucscRMPInspectCache = () => {
    chrome.storage.local.get(null, (items) => {
      console.log('Chrome storage contents:', items);
    });
  };
}

// Wait for course results to load
function waitForCourseResults() {
  const isMainEnrollmentPage = window.location.href.includes('ADMN_ENROLLMENT');
  const isIframePage = window.location.href.includes('pisa.ucsc.edu');

  if (!isMainEnrollmentPage && !isIframePage) {
    return;
  }

  const hasResults = checkForCourseResults();
  if (hasResults) {
    processExistingRows();
    return;
  }

  let attempts = 0;
  const maxAttempts = 30;

  const checkInterval = setInterval(() => {
    attempts++;
    const hasResults = checkForCourseResults();
    if (hasResults) {
      processExistingRows();
      clearInterval(checkInterval);
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
    }
  }, 1000);
}

// Check for course results
function checkForCourseResults() {
  const indicators = [
    'div.panel.panel-default.row',
    '[id*="rowpanel_"]',
    'div[class*="panel-default"][class*="row"]',
    '.search-results',
    '[class*="course"]',
    'table',
    'tr',
    'form[name*="search"]',
    '[class*="result"]'
  ];

  for (const indicator of indicators) {
    const elements = document.querySelectorAll(indicator);
    if (elements.length > 0) {
      return true;
    }
  }

  const pageText = document.body.textContent.toLowerCase();
  const resultKeywords = ['instructor:', 'credits:', 'section:', 'enroll'];
  return resultKeywords.some((keyword) => pageText.includes(keyword));
}

// Setup mutation observer
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const courseIndicators = [
              'div.panel.panel-default.row',
              '[class*="panel"]',
              '[class*="course"]',
              '[id*="rowpanel"]'
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
    attributeOldValue: true
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
  const courseRowSelectors = [
    'div.panel.panel-default.row',
    '.panel.panel-default.row',
    'div[class*="panel"][class*="row"]',
    '[id*="rowpanel_"]'
  ];

  let courseRows = [];

  for (const selector of courseRowSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      courseRows = elements;
      break;
    }
  }

  if (courseRows.length === 0) {
    return 0;
  }

  courseRows.forEach((row) => {
    if (processedRows.has(row)) {
      return;
    }

    const instructorName = extractInstructorName(row);
    if (instructorName && instructorName !== 'STAFF/TBA') {
      const course = extractCourseCode(row);
      processInstructor(row, instructorName, course);
      processedRows.add(row);
    }
  });

  return courseRows.length;
}

// Extract course code (e.g., "CSE 101")
function extractCourseCode(row) {
  const titleElements = row.querySelectorAll('h3, h2, .course-title, [class*="title"]');

  for (const element of titleElements) {
    const text = element.textContent.trim();
    const courseMatch = text.match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
    if (courseMatch) {
      return `${courseMatch[1]} ${courseMatch[2]}`;
    }
  }

  const rowText = row.textContent;
  const courseMatch = rowText.match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
  if (courseMatch) {
    return `${courseMatch[1]} ${courseMatch[2]}`;
  }

  return null;
}

// Extract instructor name
function extractInstructorName(row) {
  // Manual mapping names (for complex name patterns)
  const manualMappingNames = [
    'Berrahmoun,A.',
    'Hibbert-Jones,W.D.',
    'Hernandez Garavito,C.',
    'Mascarenhas Menna Barreto,J.',
    'Simons,J.',
    'Fehren-Schmitz,L.',
    'Shange-Binion,S.T.',
    'Ramirez-Ruiz,E.J.',
    'Kilpatrick,A.M.',
    'Stone,C.M.',
    'Rodriguez-Montero,P.',
    'Ballard,P.',
    'brice,m.',
    'Heady,K.K.',
    'Morozova,O.',
    'Corbett-Detig,R.',
    'Haussler,D.',
    'Green,R.E.',
    'Eroy-Reveles,A.A.',
    'Binder,C.M.',
    'Wu,T.',
    'Chatziafratis,E.',
    'Wardrip-Fruin,N.',
    'LeBron,M',
    'Renau Ardevol,J',
    'Garrick-Bethell,I',
    'McGuire,S',
    'Kim,G',
    'Gallagher-Geurtsen,T',
    'Kissell,R',
    'Ocampo-Penuela,N.',
    'Turk-Kubo,K',
    'Rizzo-Martinez,M.',
    'Stein-Rosen,G.',
    'Majzler,R.D',
    'DeGarmo,E.L',
    'Sanders-Self,M.L',
    'Cruz,M',
    'Aladro Font,J',
    'Escobar Vega,L',
    'Silva,K.G',
    'McGuinness,A',
    'Alexandradinata,A.',
    'Martinez-Galarce,M.A.',
    'Fox Tree,J.E.',
    'McNamara,M.B.',
    'Mc Kay,S.',
    'Castillo Trelles,C',
    'Alfaro Cordoba,M.',
    'McCourt,A.M.',
    'Nuila-Chae,S.L.',
    'Carney-Waddy,S.A.',
    'Garrecht-Williams,C.K.',
    'Madeline Lane',
    'WouldGo,T.'
  ];

  const rowText = row.textContent || row.innerText || '';
  for (const mappedName of manualMappingNames) {
    if (rowText.includes(mappedName)) {
      return mappedName;
    }
  }

  // Look for instructor information
  const instructorElements = row.querySelectorAll('div.col-xs-6.col-sm-3');

  for (const element of instructorElements) {
    const text = element.textContent.trim();

    if (text.includes('Instructor:') || text.includes('Professor:')) {
      const namePatterns = [
        /([A-Z][a-z-]+,[A-Z]\.?)/g,
        /([A-Z][a-z-]+,\s*[A-Z]\.?)/g,
        /([A-Z][A-Z-]+,[A-Z]\.?)/g
      ];

      for (const pattern of namePatterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          const validNames = matches.filter((name) => {
            const lowerName = name.toLowerCase();
            return (
              !lowerName.includes('staff') &&
              !lowerName.includes('tba') &&
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

  // Fallback: search entire row text
  const namePatterns = [
    /([A-Z][a-z-]+,[A-Z]\.?)/g,
    /([A-Z][a-z-]+,\s*[A-Z]\.?)/g
  ];

  for (const pattern of namePatterns) {
    const matches = rowText.match(pattern);
    if (matches && matches.length > 0) {
      const validNames = matches.filter((name) => {
        const lowerName = name.toLowerCase();
        return (
          !lowerName.includes('staff') &&
          !lowerName.includes('tba') &&
          !lowerName.includes('time') &&
          !lowerName.includes('location') &&
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

// Process instructor - inject React component
function processInstructor(row, instructorName, course = null) {
  // Check if we already have a rating card
  if (row.querySelector('.rmp-rating-card')) {
    return;
  }

  // Create container for React component
  const container = document.createElement('div');
  container.className = 'rmp-rating-container';
  row.appendChild(container);

  // Render React component
  const root = createRoot(container);
  root.render(<RatingCard instructorName={instructorName} course={course} />);
}

