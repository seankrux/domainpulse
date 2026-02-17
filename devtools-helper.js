/**
 * Chrome DevTools Debug Helper
 * 
 * Run these commands in browser console to capture debug info
 * 
 * Usage:
 * 1. Open Chrome DevTools (F12 or Cmd+Option+I)
 * 2. Go to Console tab
 * 3. Copy and paste the functions you need
 * 4. Run them and share the output
 */

// ============================================
// 1. CAPTURE CONSOLE ERRORS
// ============================================
function captureErrors() {
  const errors = [];
  const originalError = console.error;
  
  console.error = function(...args) {
    errors.push({
      type: 'error',
      message: args.join(' '),
      timestamp: new Date().toISOString()
    });
    originalError.apply(console, args);
  };

  console.log('✅ Error capture enabled. Run getCapturedErrors() to retrieve.');
  
  return function getCapturedErrors() {
    return errors;
  };
}

// ============================================
// 2. GET LOCALSTORAGE DATA
// ============================================
function getLocalStorageData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try {
      data[key] = JSON.parse(localStorage.getItem(key));
    } catch (e) {
      data[key] = localStorage.getItem(key);
    }
  }
  return data;
}

// ============================================
// 3. GET NETWORK FAILURES
// ============================================
function getNetworkFailures() {
  const entries = performance.getEntriesByType('resource');
  const failures = entries.filter(entry => {
    return entry.transferSize === 0 || 
           (entry.responseStatus && entry.responseStatus >= 400);
  });
  
  return failures.map(f => ({
    name: f.name,
    type: f.initiatorType,
    status: f.responseStatus,
    transferSize: f.transferSize,
    duration: f.duration
  }));
}

// ============================================
// 4. CHECK REACT COMPONENT STATE
// ============================================
function getReactRootState() {
  const root = document.getElementById('root');
  if (!root) {
    console.log('❌ No #root element found');
    return null;
  }
  
  console.log('✅ React root element:', root);
  console.log('📦 Children:', root.children);
  return root.innerHTML.substring(0, 500) + '...';
}

// ============================================
// 5. FULL DEBUG REPORT
// ============================================
function generateDebugReport() {
  const report = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    localStorage: getLocalStorageData(),
    networkFailures: getNetworkFailures(),
    reactRoot: getReactRootState(),
    screenResolution: {
      width: window.screen.width,
      height: window.screen.height,
      availableWidth: window.screen.availWidth,
      availableHeight: window.screen.availHeight
    },
    viewportSize: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };
  
  console.log('📋 Debug Report Generated');
  console.log('Copy this output and share with your AI assistant');
  console.table(report);
  
  return report;
}

// ============================================
// 6. CLEAR AND RESET
// ============================================
function resetApp() {
  console.warn('⚠️ This will clear all localStorage data!');
  console.log('Current data:', getLocalStorageData());
  console.log('Run confirmReset() to confirm');
  
  window.confirmReset = function() {
    localStorage.clear();
    console.log('✅ LocalStorage cleared. Reloading...');
    setTimeout(() => location.reload(), 1000);
  };
}

// ============================================
// 7. CHECK API ENDPOINTS
// ============================================
async function checkAPIEndpoints() {
  const endpoints = [
    '/api/check',
    '/api/ssl',
    '/api/whois'
  ];
  
  console.log('🔍 Checking API endpoints...');
  
  const results = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      results.push({
        endpoint,
        status: response.status,
        ok: response.ok
      });
    } catch (error) {
      results.push({
        endpoint,
        status: 'ERROR',
        ok: false,
        error: error.message
      });
    }
  }
  
  console.table(results);
  return results;
}

// ============================================
// 8. MONITOR STATE CHANGES
// ============================================
function monitorStorage(key) {
  console.log(`👀 Monitoring localStorage key: "${key}"`);
  console.log('Initial value:', localStorage.getItem(key));
  
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(keyName, value) {
    if (keyName === key) {
      console.log('📝 Setting:', {
        key: keyName,
        oldValue: localStorage.getItem(keyName),
        newValue: value
      });
    }
    originalSetItem.call(this, keyName, value);
  };
  
  console.log('Call stopMonitoring() to stop');
  
  window.stopMonitoring = function() {
    Storage.prototype.setItem = originalSetItem;
    console.log('⏹️ Monitoring stopped');
  };
}

// ============================================
// QUICK COMMANDS
// ============================================
console.log('🛠️  DevTools Helper Loaded!');
console.log('');
console.log('Available commands:');
console.log('  captureErrors()          - Start capturing console errors');
console.log('  getLocalStorageData()    - Get all localStorage data');
console.log('  getNetworkFailures()     - Get failed network requests');
console.log('  generateDebugReport()    - Full debug report');
console.log('  resetApp()               - Clear localStorage and reload');
console.log('  checkAPIEndpoints()      - Check if API endpoints work');
console.log('  monitorStorage("key")    - Monitor specific localStorage key');
console.log('');
