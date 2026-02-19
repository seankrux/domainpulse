/**
 * DomainPulse - Chrome DevTools Code Review Script
 * 
 * HOW TO USE:
 * 1. Open Chrome DevTools (F12 or Cmd+Option+I on Mac)
 * 2. Go to Console tab
 * 3. Copy and paste this entire script
 * 4. Run the audit commands one by one
 * 5. Share the results with your AI assistant
 */

console.log('🔍 DomainPulse Code Review - Chrome DevTools Audit');
console.log('='.repeat(60));

// ============================================
// 1. PERFORMANCE AUDIT
// ============================================
function performanceAudit() {
  console.group('📊 PERFORMANCE AUDIT');
  
  const entries = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');
  
  const report = {
    'Page Load Time': `${(entries.loadEventEnd - entries.startTime).toFixed(2)}ms`,
    'DOM Content Loaded': `${(entries.domContentLoadedEventEnd - entries.startTime).toFixed(2)}ms`,
    'Time to First Byte': `${entries.responseStart.toFixed(2)}ms`,
    'Total Resources': resources.length,
    'Total Transfer Size': `${(resources.reduce((acc, r) => acc + (r.transferSize || 0), 0) / 1024).toFixed(2)} KB`,
    'Total Duration': `${resources.reduce((acc, r) => acc + r.duration, 0).toFixed(2)}ms`,
    'JS Resources': resources.filter(r => r.initiatorType === 'script').length,
    'CSS Resources': resources.filter(r => r.initiatorType === 'link').length,
    'Fetch Requests': resources.filter(r => r.initiatorType === 'fetch').length
  };
  
  console.table(report);
  console.groupEnd();
  return report;
}

// ============================================
// 2. NETWORK HEALTH CHECK
// ============================================
function networkHealthCheck() {
  console.group('🌐 NETWORK HEALTH CHECK');
  
  const resources = performance.getEntriesByType('resource');
  const failures = resources.filter(r => 
    r.transferSize === 0 || 
    (r.responseStatus && r.responseStatus >= 400)
  );
  
  const apiRequests = resources.filter(r => r.name.includes('/api/'));
  
  console.log(`✅ Total Requests: ${resources.length}`);
  console.log(`❌ Failed Requests: ${failures.length}`);
  console.log(`🔌 API Requests: ${apiRequests.length}`);
  
  if (failures.length > 0) {
    console.warn('⚠️ Failed Resources:');
    console.table(failures.map(f => ({
      URL: f.name.split('/').pop(),
      Type: f.initiatorType,
      Status: f.responseStatus || 'No Response',
      Duration: `${f.duration.toFixed(0)}ms`
    })));
  }
  
  if (apiRequests.length > 0) {
    console.log('📡 API Endpoints Called:');
    console.table(apiRequests.map(a => ({
      Endpoint: a.name.split('?')[0].split('/').slice(-2).join('/'),
      Method: a.initiatorType,
      Duration: `${a.duration.toFixed(0)}ms`,
      Size: `${(a.transferSize / 1024).toFixed(2)} KB`
    })));
  }
  
  console.groupEnd();
  
  return {
    total: resources.length,
    failures: failures.length,
    apiRequests: apiRequests.length,
    failureDetails: failures
  };
}

// ============================================
// 3. LOCALSTORAGE ANALYSIS
// ============================================
function localStorageAnalysis() {
  console.group('💾 LOCALSTORAGE ANALYSIS');
  
  const data = {};
  let totalSize = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    const size = (key.length + value.length) * 2; // bytes
    totalSize += size;
    
    try {
      const parsed = JSON.parse(value);
      const itemCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
      data[key] = {
        size: `${(size / 1024).toFixed(2)} KB`,
        items: itemCount,
        type: Array.isArray(parsed) ? 'Array' : typeof parsed
      };
    } catch (e) {
      data[key] = {
        size: `${(size / 1024).toFixed(2)} KB`,
        value: value.substring(0, 50) + '...'
      };
    }
  }
  
  console.log(`📦 Total Keys: ${localStorage.length}`);
  console.log(`💽 Total Size: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log('📋 Storage Details:');
  console.table(data);
  
  // Check for DomainPulse specific keys
  const domainpulseKeys = Object.keys(data).filter(k => k.includes('domainpulse'));
  console.log(`✅ DomainPulse Keys Found: ${domainpulseKeys.length}`);
  
  console.groupEnd();
  
  return {
    totalKeys: localStorage.length,
    totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
    details: data,
    domainpulseKeys
  };
}

// ============================================
// 4. CONSOLE ERROR ANALYSIS
// ============================================
function errorAnalysis() {
  console.group('🚨 CONSOLE ERROR ANALYSIS');
  
  const errors = [];
  const warnings = [];
  
  // Capture errors for next 5 seconds
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.error = function(...args) {
    errors.push({
      message: args.join(' '),
      timestamp: new Date().toISOString()
    });
    originalError.apply(console, args);
  };
  
  console.warn = function(...args) {
    warnings.push({
      message: args.join(' '),
      timestamp: new Date().toISOString()
    });
    originalWarn.apply(console, args);
  };
  
  setTimeout(() => {
    console.error = originalError;
    console.warn = originalWarn;
    
    console.log(`❌ Errors Captured: ${errors.length}`);
    console.log(`⚠️ Warnings Captured: ${warnings.length}`);
    
    if (errors.length > 0) {
      console.table(errors);
    }
    
    if (warnings.length > 0) {
      console.table(warnings);
    }
    
    console.groupEnd();
    
    return { errors, warnings };
  }, 5000);
  
  console.log('👀 Monitoring for 5 seconds...');
  console.log('Perform actions in the app (click buttons, add domains, etc.)');
}

// ============================================
// 5. UI/UX CHECK
// ============================================
function uiCheck() {
  console.group('🎨 UI/UX CHECK');
  
  const checks = {
    'React Root Exists': !!document.getElementById('root'),
    'App Rendered': document.getElementById('root').children.length > 0,
    'Dark Mode Active': document.documentElement.classList.contains('dark'),
    'Total DOM Elements': document.getElementsByTagName('*').length,
    'Images Loaded': document.querySelectorAll('img').length,
    'Buttons Present': document.querySelectorAll('button').length,
    'Input Fields': document.querySelectorAll('input').length,
    'Tables Present': document.querySelectorAll('table').length
  };
  
  console.table(checks);
  
  // Check for common UI issues
  const issues = [];
  
  if (document.querySelectorAll('.checking').length > 5) {
    issues.push('⚠️ Many domains stuck in "Checking" state');
  }
  
  const images = document.querySelectorAll('img');
  const brokenImages = Array.from(images).filter(img => !img.complete || img.naturalHeight === 0);
  if (brokenImages.length > 0) {
    issues.push(`⚠️ ${brokenImages.length} broken images detected`);
  }
  
  if (issues.length > 0) {
    console.warn('UI Issues Found:');
    issues.forEach(issue => console.warn('  - ' + issue));
  } else {
    console.log('✅ No obvious UI issues detected');
  }
  
  console.groupEnd();
  
  return checks;
}

// ============================================
// 6. MEMORY USAGE
// ============================================
function memoryCheck() {
  console.group('🧠 MEMORY USAGE');
  
  if (performance.memory) {
    const memory = performance.memory;
    const report = {
      'Used JS Heap': `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
      'Total JS Heap': `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
      'JS Heap Limit': `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
      'Usage %': `${((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100).toFixed(1)}%`
    };
    console.table(report);
  } else {
    console.log('ℹ️ Memory API not available in this browser');
  }
  
  console.groupEnd();
}

// ============================================
// 7. FULL AUDIT REPORT
// ============================================
function runFullAudit() {
  console.clear();
  console.log('🔍 Starting Full DomainPulse Audit...\n');
  
  const timestamp = new Date().toISOString();
  console.log(`📅 Audit Started: ${timestamp}\n`);
  
  performanceAudit();
  console.log('\n');
  
  networkHealthCheck();
  console.log('\n');
  
  localStorageAnalysis();
  console.log('\n');
  
  uiCheck();
  console.log('\n');
  
  memoryCheck();
  console.log('\n');
  
  console.log('='.repeat(60));
  console.log('✅ Full audit complete!');
  console.log('📋 Copy all console output and share with your AI assistant');
  console.log('='.repeat(60));
  
  return {
    timestamp,
    message: 'Full audit completed. Check console output above.'
  };
}

// ============================================
// QUICK START GUIDE
// ============================================
console.log('\n');
console.log('🎯 DOMAINPULSE DEVTOOLS AUDIT TOOL');
console.log('='.repeat(60));
console.log('\n');
console.log('📋 AVAILABLE COMMANDS:');
console.log('─'.repeat(60));
console.log('1. runFullAudit() ............ Complete performance & health audit');
console.log('2. performanceAudit() ........ Page load & resource metrics');
console.log('3. networkHealthCheck() ...... API & network request analysis');
console.log('4. localStorageAnalysis() .... Storage usage & data check');
console.log('5. errorAnalysis() ........... Monitor errors for 5 seconds');
console.log('6. uiCheck() ................. UI/UX health verification');
console.log('7. memoryCheck() ............. Browser memory usage');
console.log('\n');
console.log('🚀 RECOMMENDED: Run "runFullAudit()" for complete review');
console.log('='.repeat(60));
console.log('\n');
