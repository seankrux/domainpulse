# 🤖 Automated Testing Infrastructure

Complete automated testing setup for DomainPulse that runs on every code change.

---

## 📋 Overview

| Component | Purpose | Trigger |
|-----------|---------|---------|
| **Unit Tests** | Test critical functions | On save, pre-commit |
| **GUI Tests** | E2E browser testing | Pre-commit, CI |
| **DevTools Audit** | Performance & A11y | On demand, CI |
| **TypeScript** | Type validation | On save, pre-commit |
| **ESLint** | Code quality | On save, pre-commit |
| **Build** | Production verification | Pre-commit, CI |

---

## 🚀 Quick Start

### Run All Tests
```bash
npm run test:auto
```

### Run Specific Tests
```bash
# Unit tests only
npm run test:unit

# GUI tests only
npm run test:gui

# DevTools audit
npm run test:devtools

# TypeScript check
npm run type-check

# Build verification
npm run build:app
```

### Watch Mode
```bash
# Run tests on file changes
npm run test:watch
```

---

## 📁 Test Files

### Unit Tests (`tests/unit/`)
- `domainService.test.ts` - URL validation, normalization
- `storage.test.ts` - localStorage operations
- `csvHelper.test.ts` - CSV parsing/export
- `auth.test.ts` - Authentication logic

### GUI Tests (`tests/*.spec.ts`)
- `dashboard.spec.ts` - Add domain flow
- `comprehensive.spec.ts` - Settings, filters, groups
- `automated_build_verify.spec.ts` - Production build
- `devtools-audit.spec.ts` - Chrome DevTools audit

---

## 🔧 MCP Server

The MCP (Model Context Protocol) server provides automated testing capabilities to AI assistants.

### Start MCP Server
```bash
npm run mcp:start
```

### Available Tools
- `run_all_tests` - Run complete test suite
- `run_typescript_check` - Type validation
- `run_unit_tests` - Vitest tests
- `run_gui_tests` - Playwright tests
- `run_devtools_audit` - Chrome DevTools audit
- `run_build` - Build verification
- `get_test_report` - Latest results
- `watch_and_test` - Watch mode

### Example Usage
```
User: "Run auto-tests on my changes"
Assistant: [Calls run_all_tests tool]
```

---

## 📊 Reports

Test reports are saved to `test-reports/`:

| File | Description |
|------|-------------|
| `summary.json` | Test summary JSON |
| `auto-test-report.json` | Full auto-test results |
| `devtools-audit-report.html` | DevTools audit HTML |
| `*.log` | Detailed test logs |

### View Reports
```bash
# Open HTML DevTools report
open test-reports/devtools-audit-report.html

# View JSON summary
cat test-reports/summary.json
```

---

## 🔄 CI/CD Integration

### GitHub Actions (`.github/workflows/automated-tests.yml`)

Runs automatically on:
- Push to main/master/develop
- Pull requests
- Manual trigger

Jobs:
1. **Test** - TypeScript, ESLint, unit, build, GUI
2. **Accessibility** - DevTools a11y audit
3. **Summary** - Combined results

### Pre-commit Hook (`.git/hooks/pre-commit`)

Runs before every commit:
- TypeScript check (required)
- ESLint (warnings allowed)
- Unit tests (warnings allowed)

Install hook:
```bash
cp .git/hooks/pre-commit .git/hooks/pre-commit.bak
chmod +x .git/hooks/pre-commit
```

---

## 🎯 Auto-Test Skill

The auto-test skill (`.qwen/skills/auto-tester/`) enables automatic testing when:

### Triggers
- User says: "test", "validate", "check", "run auto-tests"
- Code files modified (`.ts`, `.tsx`)
- Before commits

### Commands
```
"run auto-tests" → Run all tests
"run typescript" → Type check only
"run unit tests" → Vitest tests
"run gui tests" → Playwright tests
"run devtools audit" → Chrome DevTools
"get test report" → Show latest results
```

---

## 📈 Test Coverage

Target coverage: 80%

### Critical Functions (Tested)
- [x] `validateAndNormalizeUrl()` - URL validation
- [x] `loadDomains()` / `saveDomains()` - Storage
- [x] `loadSettings()` / `saveSettings()` - Settings
- [x] `parseCSV()` / `exportToCSV()` - CSV operations

### To Add
- [ ] `checkDomainWithSSL()` - Domain checking
- [ ] `AuthProvider` - Login flow
- [ ] `useMonitoring` - Worker logic
- [ ] `notificationService` - Notifications

---

## 🔍 Chrome DevTools Audit

The DevTools audit (`tests/devtools-audit.spec.ts`) checks:

### Performance
- Page load time (<5s target)
- First Contentful Paint
- DOM Content Loaded

### Accessibility
- Missing alt text
- Missing ARIA labels
- Keyboard navigation

### Best Practices
- HTTPS usage
- Deprecated APIs
- Console errors

### Output
- JSON report: `test-reports/devtools-audit-report.json`
- HTML report: `test-reports/devtools-audit-report.html`

---

## 🛠 Troubleshooting

### Tests Timeout
```bash
# Increase timeout
npm run test:gui -- --timeout=60000
```

### Playwright Browsers Missing
```bash
npx playwright install chromium
```

### Port Already in Use
```bash
# Kill existing dev server
lsof -ti:3000,3001 | xargs kill -9
```

### Test Reports Not Generated
```bash
# Create reports directory
mkdir -p test-reports
```

---

## 📝 Configuration

### Vitest (`vitest.config.ts`)
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['tests/**/*.test.ts'],
  },
});
```

### Playwright (`playwright.config.ts`)
```typescript
export default defineConfig({
  testDir: './tests',
  webServer: {
    command: 'npm run dev:all',
    url: 'http://localhost:3000',
  },
});
```

---

## 🎉 Summary

| Feature | Status |
|---------|--------|
| Unit Tests | ✅ Ready |
| GUI Tests | ✅ Ready |
| DevTools Audit | ✅ Ready |
| MCP Server | ✅ Ready |
| Auto-Test Skill | ✅ Ready |
| Pre-commit Hook | ✅ Ready |
| GitHub Actions | ✅ Ready |
| Test Reports | ✅ Ready |

**All automated testing infrastructure is complete and ready to use!**
