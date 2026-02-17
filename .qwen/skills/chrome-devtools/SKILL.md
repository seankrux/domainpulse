# Chrome DevTools Debugging Skill

## Purpose
Analyze Chrome DevTools output to identify, debug, and fix frontend errors before committing code.

## Capabilities

### 1. Console Error Analysis
- Parse error stack traces
- Identify undefined variables, type errors, reference errors
- Trace error origin to specific file/line
- Provide fix suggestions

### 2. Network Debugging
- Analyze failed API requests
- Check request/response headers
- Identify CORS issues
- Debug 4xx/5xx status codes

### 3. Application State
- Inspect localStorage/sessionStorage
- Analyze cookies
- Check IndexedDB data
- Debug React component state

### 4. Performance Issues
- Identify slow renders
- Analyze bundle size warnings
- Check memory leaks
- Optimize re-renders

### 5. DOM/CSS Issues
- Debug layout problems
- Identify z-index conflicts
- Check responsive design issues
- Fix CSS class mismatches

## Usage

### Share DevTools Output
1. **Console Errors**: Copy error message + stack trace
2. **Network Tab**: Share failed request details
3. **Application Tab**: Export localStorage data
4. **Screenshots**: Share DevTools screenshots

### I Will
1. ✅ Identify root cause
2. ✅ Provide code fix
3. ✅ Explain the issue
4. ✅ Prevent future occurrences

## Example Commands

```javascript
// Get localStorage data
JSON.stringify(localStorage, null, 2)

// Get console errors
performance.getEntriesByType('error')

// Check network failures
performance.getEntriesByType('resource').filter(r => r.transferSize === 0)
```

## Common Fixes

### ReferenceError: X is not defined
- Check imports
- Verify variable scope
- Check prop destructuring

### TypeError: Cannot read property of undefined
- Add optional chaining (?.)
- Add null checks
- Verify API response structure

### CORS Errors
- Check API endpoint
- Verify server headers
- Use proxy in development

### Build Warnings
- Large bundle → code splitting
- Missing keys → add key props
- Prop type mismatches → fix TypeScript
