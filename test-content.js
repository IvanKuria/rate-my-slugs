// Simple test content script
console.log('🧪 TEST: Simple content script loaded');
console.log('🧪 TEST: URL:', window.location.href);
console.log('🧪 TEST: Ready state:', document.readyState);

// Add a simple global function
window.testFunction = function() {
  console.log('🧪 TEST: Function works!');
  return 'Extension is working';
};

// Add comprehensive course finder
window.findCourseElements = function() {
  console.log('🔧 Finding course elements manually...');
  
  // Search for any text that looks like course content
  const allElements = document.querySelectorAll('*');
  const courseElements = [];
  
  allElements.forEach(el => {
    const text = el.textContent || '';
    if (text.includes('Instructor:') || 
        text.includes('Credits:') || 
        text.includes('Section:') ||
        text.includes('Enroll') ||
        text.includes('Units') ||
        text.includes('Class') ||
        /[A-Z][a-z]+,[A-Z]\.?/.test(text) || // Name patterns
        /\b[A-Z]{2,4}\s*\d{1,3}[A-Z]?\b/.test(text)) { // Course codes
      courseElements.push(el);
    }
  });
  
  console.log(`Found ${courseElements.length} potential course elements`);
  
  if (courseElements.length > 0) {
    console.log('Sample elements:');
    courseElements.slice(0, 5).forEach((el, idx) => {
      console.log(`Element ${idx + 1}:`, {
        tag: el.tagName,
        className: el.className,
        id: el.id,
        text: el.textContent.substring(0, 150)
      });
    });
  }
  
  return courseElements;
};

console.log('🧪 TEST: Functions available: testFunction(), findCourseElements()');

// Keep functions available by re-adding them periodically
setInterval(() => {
  if (!window.testFunction) {
    window.testFunction = function() {
      console.log('🧪 TEST: Function works!');
      return 'Extension is working';
    };
  }
  
  if (!window.findCourseElements) {
    window.findCourseElements = function() {
      console.log('🔧 Finding course elements manually...');
      
      // Search for any text that looks like course content
      const allElements = document.querySelectorAll('*');
      const courseElements = [];
      
      allElements.forEach(el => {
        const text = el.textContent || '';
        if (text.includes('Instructor:') || 
            text.includes('Credits:') || 
            text.includes('Section:') ||
            text.includes('Enroll') ||
            text.includes('Units') ||
            text.includes('Class') ||
            /[A-Z][a-z]+,[A-Z]\.?/.test(text) || // Name patterns
            /\b[A-Z]{2,4}\s*\d{1,3}[A-Z]?\b/.test(text)) { // Course codes
          courseElements.push(el);
        }
      });
      
      console.log(`Found ${courseElements.length} potential course elements`);
      
      if (courseElements.length > 0) {
        console.log('Sample elements:');
        courseElements.slice(0, 5).forEach((el, idx) => {
          console.log(`Element ${idx + 1}:`, {
            tag: el.tagName,
            className: el.className,
            id: el.id,
            text: el.textContent.substring(0, 150)
          });
        });
      }
      
      return courseElements;
    };
  }
}, 2000); // Re-add functions every 2 seconds
