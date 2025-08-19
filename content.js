// UCSC Rate My Professors Content Script
// Finds course rows and injects RMP ratings

class UCSCRMPExtension {
  constructor() {
    this.processedRows = new Set();
    this.cache = new Map();
    this.debounceTimer = null;
    this.init();
  }

  init() {
    console.log('🎓 UCSC RMP Extension loaded');
    console.log('📍 Current URL:', window.location.href);
    console.log('📊 Page ready state:', document.readyState);
    
    // Add global functions for manual testing with proper binding
    const self = this;
    
    window.ucscRMPDebug = function() {
      console.log('🔧 Manual debug trigger');
      return self.processExistingRows();
    };
    
    window.ucscRMPCheck = function() {
      console.log('🔧 Manual results check');
      return self.checkForCourseResults();
    };
    
    window.ucscRMPForceSearch = function() {
      console.log('🔧 Force searching for course elements');
      const allDivs = document.querySelectorAll('div');
      console.log(`Found ${allDivs.length} div elements total`);
      
      // Look for any divs containing instructor-like text
      const courseDivs = Array.from(allDivs).filter(div => {
        const text = div.textContent || '';
        return text.includes('Instructor:') || 
               text.includes('Credits:') || 
               /[A-Z][a-z]+,[A-Z]\.?/.test(text);
      });
      
      console.log(`Found ${courseDivs.length} divs with course-like content`);
      courseDivs.forEach((div, idx) => {
        if (idx < 3) {
          console.log(`Course Div ${idx + 1}:`, {
            tag: div.tagName,
            className: div.className,
            id: div.id,
            text: div.textContent.substring(0, 100)
          });
        }
      });
      
      return courseDivs;
    };
    
               window.ucscRMPRefresh = function(instructorName) {
             console.log(`🔄 Refreshing data for: ${instructorName}`);
             chrome.runtime.sendMessage({
               action: 'refreshProfessor',
               instructorName: instructorName
             }, (response) => {
               console.log('Refresh response:', response);
               // Reload the page to see updated data
               window.location.reload();
             });
           };

           window.ucscRMPClearCache = function() {
             console.log('🧹 Clearing all cache');
             chrome.runtime.sendMessage({
               action: 'clearCache'
             }, (response) => {
               console.log('Cache cleared:', response);
               if (response.success) {
                 console.log('✅ Cache successfully cleared, reloading page...');
                 window.location.reload();
               } else {
                 console.error('❌ Cache clearing failed:', response.error);
               }
             });
           };

           window.ucscRMPInspectCache = function() {
             console.log('🔍 Inspecting cache...');
             chrome.storage.local.get(null, (items) => {
               console.log('Chrome storage contents:', items);
               const keys = Object.keys(items);
               if (keys.length === 0) {
                 console.log('📭 Cache is empty');
               } else {
                 console.log(`📦 Found ${keys.length} cached items:`);
                 keys.forEach(key => {
                   console.log(`  - ${key}:`, items[key]);
                 });
               }
             });
           };

           console.log('🔧 Debug functions available:');
           console.log('   ucscRMPDebug() - trigger normal processing');
           console.log('   ucscRMPCheck() - check if results detected');
           console.log('   ucscRMPForceSearch() - force search for course elements');
           console.log('   ucscRMPRefresh("LastName,F.") - refresh specific professor');
           console.log('   ucscRMPClearCache() - clear all cached data');
           console.log('   ucscRMPInspectCache() - see what is currently cached');
    
        // Keep functions available by re-adding them periodically since URL doesn't change
    setInterval(() => {
      if (!window.ucscRMPDebug) {
        window.ucscRMPDebug = function() {
          console.log('🔧 Manual debug trigger');
          return self.processExistingRows();
        };
      }
      if (!window.ucscRMPCheck) {
        window.ucscRMPCheck = function() {
          console.log('🔧 Manual results check');
          return self.checkForCourseResults();
        };
      }
      if (!window.ucscRMPForceSearch) {
        window.ucscRMPForceSearch = function() {
          console.log('🔧 Force searching for course elements');
          const allDivs = document.querySelectorAll('div');
          console.log(`Found ${allDivs.length} div elements total`);

          // Look for any divs containing instructor-like text
          const courseDivs = Array.from(allDivs).filter(div => {
            const text = div.textContent || '';
            return text.includes('Instructor:') ||
                   text.includes('Credits:') ||
                   /[A-Z][a-z]+,[A-Z]\.?/.test(text);
          });

          console.log(`Found ${courseDivs.length} divs with course-like content`);
          courseDivs.forEach((div, idx) => {
            if (idx < 3) {
              console.log(`Course Div ${idx + 1}:`, {
                tag: div.tagName,
                className: div.className,
                id: div.id,
                text: div.textContent.substring(0, 100)
              });
            }
          });

          return courseDivs;
        };
      }
      if (!window.ucscRMPRefresh) {
        window.ucscRMPRefresh = function(instructorName) {
          console.log(`🔄 Refreshing data for: ${instructorName}`);
          chrome.runtime.sendMessage({
            action: 'refreshProfessor',
            instructorName: instructorName
          }, (response) => {
            console.log('Refresh response:', response);
            // Reload the page to see updated data
            window.location.reload();
          });
        };
      }
      if (!window.ucscRMPClearCache) {
        window.ucscRMPClearCache = function() {
          console.log('🧹 Clearing all cache');
          chrome.runtime.sendMessage({
            action: 'clearCache'
          }, (response) => {
            console.log('Cache cleared:', response);
            if (response.success) {
              console.log('✅ Cache successfully cleared, reloading page...');
              window.location.reload();
            } else {
              console.error('❌ Cache clearing failed:', response.error);
            }
          });
        };
      }
      if (!window.ucscRMPInspectCache) {
        window.ucscRMPInspectCache = function() {
          console.log('🔍 Inspecting cache...');
          chrome.storage.local.get(null, (items) => {
            console.log('Chrome storage contents:', items);
            const keys = Object.keys(items);
            if (keys.length === 0) {
              console.log('📭 Cache is empty');
            } else {
              console.log(`📦 Found ${keys.length} cached items:`);
              keys.forEach(key => {
                console.log(`  - ${key}:`, items[key]);
              });
            }
          });
        };
      }
    }, 3000); // Re-add every 3 seconds
    
    // Wait for course results to load before processing
    this.waitForCourseResults();
    this.setupMutationObserver();
  }

  waitForCourseResults() {
    // Check if we're on the enrollment page or the iframe with course results
    const isMainEnrollmentPage = window.location.href.includes('ADMN_ENROLLMENT');
    const isIframePage = window.location.href.includes('pisa.ucsc.edu');
    
    if (!isMainEnrollmentPage && !isIframePage) {
      console.log('📍 Not on enrollment page or iframe, skipping');
      return;
    }
    
    if (isIframePage) {
      console.log('📍 On iframe page - this is where course results should be!');
    }

    console.log('📍 On enrollment page, checking for course results...');

    // Check if course results are already loaded
    const hasResults = this.checkForCourseResults();
    if (hasResults) {
      console.log('✅ Course results already loaded, processing immediately');
      this.processExistingRows();
      return;
    }

    // Set up interval to watch for course results to appear
    let attempts = 0;
    const maxAttempts = 30; // Increased attempts since results may take time to load
    
    const checkInterval = setInterval(() => {
      attempts++;
      console.log(`🔄 Waiting for course results (attempt ${attempts}/${maxAttempts})`);
      
      const hasResults = this.checkForCourseResults();
      if (hasResults) {
        console.log('✅ Course results detected! Processing rows...');
        const foundRows = this.processExistingRows();
        console.log(`🛑 Stopping check - found ${foundRows} course rows`);
        clearInterval(checkInterval);
      } else if (attempts >= maxAttempts) {
        console.log('🛑 Stopping check - max attempts reached without finding course results');
        clearInterval(checkInterval);
      }
    }, 1000); // Check every 1 second
  }

  checkForCourseResults() {
    // Look for indicators that course results have loaded
    const indicators = [
      'div.panel.panel-default.row', // Bootstrap course rows
      '[id*="rowpanel_"]', // Row panel IDs
      'div[class*="panel-default"][class*="row"]', // Alternative panel structure
      '.search-results', // Generic results container
      '[class*="course"]', // Any course-related classes
      'table', // Tables (common in iframe results)
      'tr', // Table rows
      'form[name*="search"]', // Search forms
      '[class*="result"]' // Result containers
    ];

    for (const indicator of indicators) {
      const elements = document.querySelectorAll(indicator);
      if (elements.length > 0) {
        console.log(`📊 Course results indicator found: '${indicator}' (${elements.length} elements)`);
        return true;
      }
    }

    // Also check for text content that suggests results are loaded
    const pageText = document.body.textContent.toLowerCase();
    const resultKeywords = ['instructor:', 'credits:', 'section:', 'enroll'];
    const hasResultKeywords = resultKeywords.some(keyword => pageText.includes(keyword));
    
    if (hasResultKeywords) {
      console.log('📊 Course results detected by keywords');
      return true;
    }

    return false;
  }

  setupMutationObserver() {
    // Watch for DOM changes (pagination, filters, etc.)
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              console.log('🔄 DOM change detected:', node.tagName, node.className);
              
              // Check for any course-related additions
              const courseIndicators = [
                'div.panel.panel-default.row',
                '[class*="panel"]',
                '[class*="course"]',
                '[id*="rowpanel"]'
              ];
              
              for (const indicator of courseIndicators) {
                if ((node.matches && node.matches(indicator)) || 
                    (node.querySelector && node.querySelector(indicator))) {
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
        console.log('🔄 DOM changes suggest course results loaded, processing...');
        this.debounceProcess();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true
    });
    
    console.log('👁️ MutationObserver set up to watch for DOM changes');
  }

  debounceProcess() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.processExistingRows();
    }, 500);
  }

  processExistingRows() {
    // Use the correct Bootstrap selectors from the HTML
    const courseRowSelectors = [
      'div.panel.panel-default.row', // Main course rows
      '.panel.panel-default.row', // Alternative
      'div[class*="panel"][class*="row"]', // More flexible
      '[id*="rowpanel_"]' // Specific row panel IDs
    ];
    
    let courseRows = [];
    let usedSelector = '';
    
    for (const selector of courseRowSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`🔍 Trying selector '${selector}': found ${elements.length} elements`);
      
      if (elements.length > 0) {
        courseRows = elements;
        usedSelector = selector;
        console.log(`✅ Using selector: ${selector} (${elements.length} rows)`);
        break;
      }
    }
    
    if (courseRows.length === 0) {
      console.log('❌ No course rows found with any selector');
      // Try to find any divs that might be course rows
      const allPanels = document.querySelectorAll('div[class*="panel"]');
      const allRows = document.querySelectorAll('div[class*="row"]');
      console.log(`🔍 Found ${allPanels.length} panel elements and ${allRows.length} row elements on page`);
      
      // Debug: show what the panel elements actually look like
      if (allPanels.length > 0) {
        console.log('📋 Sample panel elements:');
        allPanels.forEach((panel, index) => {
          if (index < 5) { // Show first 5
            console.log(`Panel ${index + 1}:`, panel.className, '|', panel.textContent.substring(0, 100));
          }
        });
      }
      
      // Let's try to find ANY elements that might contain course information
      console.log('🔍 Searching for ANY elements that might be course rows...');
      
      // Search for elements containing instructor-like text
      const allElements = document.querySelectorAll('*');
      const potentialCourseElements = [];
      
      allElements.forEach(el => {
        const text = el.textContent || '';
        // More comprehensive search patterns
        if (text.includes('Instructor:') || 
            text.includes('Credits:') || 
            text.includes('Section:') ||
            text.includes('Enroll') ||
            text.includes('Units:') ||
            text.includes('Class:') ||
            text.includes('Component:') ||
            /[A-Z][a-z]+,[A-Z]\.?/.test(text) || // Name pattern like "Simons,J."
            /\b[A-Z]{2,4}\s*\d{1,3}[A-Z]?\b/.test(text) || // Course codes like "CMPS 101"
            /\d{4}\s*-\s*\d{2}\s*-\s*\d{2}/.test(text) || // Dates
            /\d+\s*Units/.test(text)) { // Units text
          potentialCourseElements.push(el);
        }
      });
      
      console.log(`🎯 Found ${potentialCourseElements.length} elements with course-like content`);
      
      if (potentialCourseElements.length > 0) {
        console.log('📋 Sample course-like elements:');
        potentialCourseElements.slice(0, 5).forEach((el, idx) => {
          console.log(`Course Element ${idx + 1}:`);
          console.log(`  Tag: ${el.tagName}`);
          console.log(`  Class: ${el.className}`);
          console.log(`  ID: ${el.id}`);
          console.log(`  Text: ${el.textContent.substring(0, 100)}...`);
          console.log(`  Parent: ${el.parentElement?.tagName}.${el.parentElement?.className}`);
          console.log('---');
        });
      }
      
      // Also check for common table/grid structures
      const tableSelectors = [
        'table tr',
        'tbody tr', 
        '[role="row"]',
        '[role="gridcell"]',
        'tr',
        'td'
      ];
      
      console.log('🔍 Checking for table/grid structures:');
      tableSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`  ${selector}: ${elements.length} elements`);
      });
      
      return 0;
    }
    
    courseRows.forEach((row, index) => {
      console.log(`📋 Processing row ${index + 1}:`, row);
      
      if (this.processedRows.has(row)) {
        console.log(`⏭️ Row ${index + 1} already processed, skipping`);
        return; // Already processed
      }

      const instructorName = this.extractInstructorName(row);
      console.log(`👨‍🏫 Extracted instructor name from row ${index + 1}:`, instructorName);
      
      if (instructorName && instructorName !== 'STAFF/TBA') {
        console.log(`✅ Processing instructor: ${instructorName}`);
        this.processInstructor(row, instructorName);
        this.processedRows.add(row);
      } else {
        console.log(`❌ Skipping row ${index + 1}: no valid instructor name`);
      }
    });
    
    return courseRows.length;
  }

  extractInstructorName(row) {
    // Look for instructor information in Bootstrap column elements
    const instructorElements = row.querySelectorAll('div.col-xs-6.col-sm-3');
    console.log(`🔍 Found ${instructorElements.length} Bootstrap column elements`);
    
    for (const element of instructorElements) {
      const text = element.textContent.trim();
      console.log(`📝 Checking column element: "${text}"`);
      
      // Check if this element contains instructor information
      if (text.includes('Instructor:') || text.includes('Professor:')) {
        console.log('✅ Found instructor-related column!');
        
        // Extract instructor name using patterns
        const namePatterns = [
          /([A-Z][a-z]+,[A-Z]\.?)/g, // "Simons,J."
          /([A-Z][a-z]+,\s*[A-Z]\.?)/g, // "Simons, J."
          /([A-Z][A-Z]+,[A-Z]\.?)/g, // "SMITH,J."
        ];
        
        for (const pattern of namePatterns) {
          const matches = text.match(pattern);
          if (matches && matches.length > 0) {
            const validNames = matches.filter(name => {
              const lowerName = name.toLowerCase();
              return !lowerName.includes('staff') && 
                     !lowerName.includes('tba') &&
                     name.length > 3;
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
    const rowText = row.textContent || row.innerText || '';
    console.log(`📝 Fallback: searching entire row text: "${rowText.substring(0, 100)}..."`);
    
    const namePatterns = [
      /([A-Z][a-z]+,[A-Z]\.?)/g, // "Simons,J."
      /([A-Z][a-z]+,\s*[A-Z]\.?)/g, // "Simons, J."
    ];
    
    for (const pattern of namePatterns) {
      const matches = rowText.match(pattern);
      if (matches && matches.length > 0) {
        const validNames = matches.filter(name => {
          const lowerName = name.toLowerCase();
          return !lowerName.includes('staff') && 
                 !lowerName.includes('tba') &&
                 !lowerName.includes('time') &&
                 !lowerName.includes('location') &&
                 name.length > 3;
        });
        
        if (validNames.length > 0) {
          console.log(`👨‍🏫 Found instructor name in row text: ${validNames[0]}`);
          return validNames[0];
        }
      }
    }
    
    console.log('❌ No instructor name found in row');
    return null;
  }

  async processInstructor(row, instructorName) {
    // Check if we already have a rating card
    if (row.querySelector('.rmp-rating-card')) {
      return;
    }

    // Create loading card
    const loadingCard = this.createRatingCard('loading', instructorName);
    row.appendChild(loadingCard);

    try {
      console.log(`📤 Sending message to background script for: ${instructorName}`);
      // Request rating from background script
      const response = await chrome.runtime.sendMessage({
        action: 'getProfessorRating',
        instructorName: instructorName
      });
      
      console.log(`📥 Received response from background script:`, response);

      // Update card with result
      this.updateRatingCard(loadingCard, response);

    } catch (error) {
      console.error('Error getting professor rating:', error);
      this.updateRatingCard(loadingCard, { status: 'error' });
    }
  }

  createRatingCard(status, instructorName) {
    const card = document.createElement('div');
    card.className = 'rmp-rating-card';
    card.dataset.instructor = instructorName;
    card.dataset.status = status;

    const content = document.createElement('div');
    content.className = 'rmp-content';

    switch (status) {
      case 'loading':
        content.innerHTML = `
          <div class="rmp-header">
            <span class="rmp-title">Rate My Professors</span>
            <span class="rmp-loading">Loading ratings...</span>
          </div>
        `;
        break;
      case 'success':
        content.innerHTML = `
          <div class="rmp-header">
            <span class="rmp-title">Rate My Professors</span>
            <span class="rmp-instructor">${instructorName}</span>
          </div>
        `;
        break;
      case 'error':
        content.innerHTML = `
          <div class="rmp-header">
            <span class="rmp-title">Rate My Professors</span>
            <span class="rmp-error">Unable to load ratings</span>
          </div>
        `;
        break;
      case 'no-profile':
        content.innerHTML = `
          <div class="rmp-header">
            <span class="rmp-title">Rate My Professors</span>
            <span class="rmp-no-profile">No ratings found</span>
          </div>
        `;
        break;
    }

    card.appendChild(content);
    return card;
  }

  updateRatingCard(card, data) {
    const content = card.querySelector('.rmp-content');
    card.dataset.status = data.status;

    if (data.status === 'success' && data.rating) {
      const rating = data.rating;
      content.innerHTML = `
        <div class="rmp-header">
          <span class="rmp-title">Rate My Professors</span>
          <span class="rmp-instructor">${data.instructorName}</span>
        </div>
        <div class="rmp-stats">
          <div class="rmp-stat">
            <span class="rmp-label">Overall Rating</span>
            <span class="rmp-value rmp-rating">${rating.overallRating}/5.0</span>
          </div>
          <div class="rmp-stat">
            <span class="rmp-label">Difficulty</span>
            <span class="rmp-value rmp-difficulty">${rating.difficulty}/5.0</span>
          </div>
          <div class="rmp-stat">
            <span class="rmp-label">Would Take Again</span>
            <span class="rmp-value rmp-take-again">${rating.wouldTakeAgainPercent}%</span>
          </div>
          <div class="rmp-stat">
            <span class="rmp-label">Total Reviews</span>
            <span class="rmp-value rmp-count">${rating.numRatings}</span>
          </div>
        </div>
        <div class="rmp-footer">
          <a href="${rating.rmpUrl}" target="_blank" class="rmp-link">
            View Full Profile →
          </a>
        </div>
      `;
    } else if (data.status === 'no-profile') {
      content.innerHTML = `
        <div class="rmp-header">
          <span class="rmp-title">Rate My Professors</span>
          <span class="rmp-instructor">${data.instructorName}</span>
        </div>
        <div class="rmp-message">No ratings found</div>
      `;
    } else if (data.status === 'error') {
      content.innerHTML = `
        <div class="rmp-header">
          <span class="rmp-title">Rate My Professors</span>
          <span class="rmp-instructor">${data.instructorName}</span>
        </div>
        <div class="rmp-message">Unable to load ratings</div>
      `;
    }
  }
}

// Initialize the extension when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new UCSCRMPExtension();
  });
} else {
  new UCSCRMPExtension();
}
