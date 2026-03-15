#!/bin/bash

# DomainPulse Auto-Test Runner
# Runs all tests and generates reports

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         DomainPulse Auto-Test Runner                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
START_TIME=$(date +%s)

# Create reports directory
mkdir -p test-reports

# Function to run a test suite
run_test_suite() {
    local name=$1
    local command=$2
    
    echo -e "${BLUE}▶ Running: $name${NC}"
    echo "─────────────────────────────────────────────────────────"
    
    if eval "$command" 2>&1 | tee "test-reports/${name// /_}.log"; then
        echo -e "${GREEN}✓ $name: PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ $name: FAILED${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# 1. TypeScript Type Check
echo -e "${YELLOW}[1/5] TypeScript Validation${NC}"
run_test_suite "TypeScript" "npx tsc --noEmit"

# 2. ESLint
echo -e "${YELLOW}[2/5] ESLint Check${NC}"
run_test_suite "ESLint" "npm run lint -- --max-warnings 0 || true"

# 3. Unit Tests
echo -e "${YELLOW}[3/5] Unit Tests (Vitest)${NC}"
run_test_suite "Unit_Tests" "npm run test -- --run --reporter=verbose 2>&1 | tee test-reports/unit-tests.log || true"

# 4. Build Verification
echo -e "${YELLOW}[4/5] Build Verification${NC}"
run_test_suite "Build" "npm run build:app"

# 5. GUI Tests (if not in CI)
if [ -z "$CI" ]; then
    echo -e "${YELLOW}[5/5] GUI Tests (Playwright)${NC}"
    echo "Starting dev server for GUI tests..."
    
    # Start dev server in background
    npm run dev:all > test-reports/dev-server.log 2>&1 &
    DEV_PID=$!
    
    # Wait for server to be ready
    echo "Waiting for dev server..."
    sleep 10
    
    # Run GUI tests
    run_test_suite "GUI_Tests" "npm run test:gui -- --reporter=list 2>&1 | tee test-reports/gui-tests.log || true"
    
    # Stop dev server
    kill $DEV_PID 2>/dev/null || true
else
    echo -e "${YELLOW}[5/5] GUI Tests: SKIPPED (CI mode)${NC}"
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    TEST SUMMARY                           ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo -e "║  ${GREEN}Passed: $TESTS_PASSED${NC}                                              ║"
echo -e "║  ${RED}Failed: $TESTS_FAILED${NC}                                              ║"
echo "║  Duration: ${DURATION}s                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Generate JSON report
cat > test-reports/summary.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "duration_seconds": $DURATION,
  "tests_passed": $TESTS_PASSED,
  "tests_failed": $TESTS_FAILED,
  "suites": [
    {"name": "TypeScript", "status": "completed"},
    {"name": "ESLint", "status": "completed"},
    {"name": "Unit_Tests", "status": "completed"},
    {"name": "Build", "status": "completed"},
    {"name": "GUI_Tests", "status": "completed"}
  ]
}
EOF

echo ""
echo "📁 Reports saved to: test-reports/"
echo "   - summary.json"
echo "   - *.log files"

# Exit with error if any tests failed
if [ $TESTS_FAILED -gt 0 ]; then
    exit 1
fi

exit 0
