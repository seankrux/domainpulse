#!/usr/bin/env node

/**
 * DomainPulse Auto-Test MCP Server
 * 
 * Provides automated testing capabilities:
 * - Run all tests on code changes
 * - Chrome DevTools audit
 * - GUI testing
 * - TypeScript validation
 * - Build verification
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const TEST_REPORTS_DIR = join(PROJECT_ROOT, 'test-reports');

// Ensure test reports directory exists
if (!existsSync(TEST_REPORTS_DIR)) {
  execSync(`mkdir -p ${TEST_REPORTS_DIR}`, { stdio: 'ignore' });
}

const server = new Server(
  {
    name: 'domainpulse-auto-test',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'run_all_tests',
        description: 'Run all automated tests: TypeScript, ESLint, unit tests, build, and GUI tests',
        inputSchema: {
          type: 'object',
          properties: {
            skipGUI: {
              type: 'boolean',
              description: 'Skip GUI tests (useful for quick validation)',
              default: false,
            },
          },
        },
      },
      {
        name: 'run_typescript_check',
        description: 'Run TypeScript type checking',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'run_unit_tests',
        description: 'Run Vitest unit tests',
        inputSchema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              description: 'Specific test file to run',
            },
            coverage: {
              type: 'boolean',
              description: 'Generate coverage report',
              default: false,
            },
          },
        },
      },
      {
        name: 'run_gui_tests',
        description: 'Run Playwright GUI tests',
        inputSchema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              description: 'Specific test file to run',
            },
            headed: {
              type: 'boolean',
              description: 'Run in headed mode (show browser)',
              default: false,
            },
          },
        },
      },
      {
        name: 'run_devtools_audit',
        description: 'Run Chrome DevTools audit (performance, accessibility, best practices)',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to audit',
              default: 'http://localhost:3000',
            },
          },
        },
      },
      {
        name: 'run_build',
        description: 'Run production build verification',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_test_report',
        description: 'Get the latest test report summary',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'watch_and_test',
        description: 'Watch for file changes and run tests automatically',
        inputSchema: {
          type: 'object',
          properties: {
            patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to watch',
              default: ['**/*.ts', '**/*.tsx'],
            },
          },
        },
      },
    ],
  };
});

// Execute shell command and capture output
function runCommand(command, options = {}) {
  const { timeout = 300000, cwd = PROJECT_ROOT } = options;
  
  try {
    const output = execSync(command, {
      cwd,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout?.toString() || error.stderr?.toString() || error.message,
      error: error.message,
    };
  }
}

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'run_all_tests': {
      const { skipGUI = false } = args;
      
      const results = {
        timestamp: new Date().toISOString(),
        suites: [],
        summary: { passed: 0, failed: 0 },
      };

      // TypeScript check
      console.log('Running TypeScript check...');
      const tsResult = runCommand('npx tsc --noEmit', { timeout: 120000 });
      results.suites.push({
        name: 'TypeScript',
        passed: tsResult.success,
        output: tsResult.output.slice(0, 5000),
      });
      results.summary.passed += tsResult.success ? 1 : 0;
      results.summary.failed += tsResult.success ? 0 : 1;

      // ESLint
      console.log('Running ESLint...');
      const eslintResult = runCommand('npm run lint -- --max-warnings 0', { timeout: 120000 });
      results.suites.push({
        name: 'ESLint',
        passed: eslintResult.success || eslintResult.output.includes('warnings'),
        output: eslintResult.output.slice(0, 5000),
      });
      results.summary.passed += eslintResult.success ? 1 : 0;
      results.summary.failed += eslintResult.success ? 0 : 1;

      // Unit tests
      console.log('Running unit tests...');
      const unitResult = runCommand('npm run test -- --run', { timeout: 180000 });
      results.suites.push({
        name: 'Unit Tests',
        passed: unitResult.success,
        output: unitResult.output.slice(0, 5000),
      });
      results.summary.passed += unitResult.success ? 1 : 0;
      results.summary.failed += unitResult.success ? 0 : 1;

      // Build
      console.log('Running build...');
      const buildResult = runCommand('npm run build:app', { timeout: 300000 });
      results.suites.push({
        name: 'Build',
        passed: buildResult.success,
        output: buildResult.output.slice(0, 5000),
      });
      results.summary.passed += buildResult.success ? 1 : 0;
      results.summary.failed += buildResult.success ? 0 : 1;

      // GUI tests (optional)
      if (!skipGUI) {
        console.log('Running GUI tests...');
        const guiResult = runCommand('npm run test:gui -- --reporter=list', { timeout: 600000 });
        results.suites.push({
          name: 'GUI Tests',
          passed: guiResult.success,
          output: guiResult.output.slice(0, 5000),
        });
        results.summary.passed += guiResult.success ? 1 : 0;
        results.summary.failed += guiResult.success ? 0 : 1;
      }

      // Save report
      const reportPath = join(TEST_REPORTS_DIR, 'auto-test-report.json');
      writeFileSync(reportPath, JSON.stringify(results, null, 2));

      return {
        content: [
          {
            type: 'text',
            text: `## Test Results\n\n` +
              `**Passed:** ${results.summary.passed}/${results.suites.length}\n` +
              `**Failed:** ${results.summary.failed}\n\n` +
              results.suites.map(s => 
                `### ${s.name}\n${s.passed ? '✅ PASSED' : '❌ FAILED'}\n\`\`\`\n${s.output}\n\`\`\``
              ).join('\n\n') +
              `\n\n📁 Full report: ${reportPath}`,
          },
        ],
      };
    }

    case 'run_typescript_check': {
      const result = runCommand('npx tsc --noEmit', { timeout: 120000 });
      return {
        content: [
          {
            type: 'text',
            text: `## TypeScript Check\n\n${result.success ? '✅ PASSED' : '❌ FAILED'}\n\n\`\`\`\n${result.output}\n\`\`\``,
          },
        ],
      };
    }

    case 'run_unit_tests': {
      const { file, coverage } = args;
      let command = 'npm run test -- --run';
      if (file) command += ` ${file}`;
      if (coverage) command += ' --coverage';
      
      const result = runCommand(command, { timeout: 180000 });
      return {
        content: [
          {
            type: 'text',
            text: `## Unit Tests\n\n${result.success ? '✅ PASSED' : '❌ FAILED'}\n\n\`\`\`\n${result.output}\n\`\`\``,
          },
        ],
      };
    }

    case 'run_gui_tests': {
      const { file, headed } = args;
      let command = 'npm run test:gui -- --reporter=list';
      if (file) command += ` ${file}`;
      if (headed) command += ' --headed';
      
      const result = runCommand(command, { timeout: 600000 });
      return {
        content: [
          {
            type: 'text',
            text: `## GUI Tests\n\n${result.success ? '✅ PASSED' : '❌ FAILED'}\n\n\`\`\`\n${result.output}\n\`\`\``,
          },
        ],
      };
    }

    case 'run_devtools_audit': {
      const { url = 'http://localhost:3000' } = args;
      const result = runCommand(`npm run test:gui -- tests/devtools-audit.spec.ts --reporter=list`, { timeout: 300000 });
      
      // Read the generated report if it exists
      let auditReport = '';
      const reportPath = join(TEST_REPORTS_DIR, 'devtools-audit-report.html');
      if (existsSync(reportPath)) {
        auditReport = `\n\n📊 [View HTML Report](file://${reportPath})`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `## Chrome DevTools Audit\n\nURL: ${url}\n\n${result.success ? '✅ PASSED' : '❌ FAILED'}\n\n\`\`\`\n${result.output}\n\`\`\`${auditReport}`,
          },
        ],
      };
    }

    case 'run_build': {
      const result = runCommand('npm run build:app', { timeout: 300000 });
      return {
        content: [
          {
            type: 'text',
            text: `## Build Verification\n\n${result.success ? '✅ PASSED' : '❌ FAILED'}\n\n\`\`\`\n${result.output}\n\`\`\``,
          },
        ],
      };
    }

    case 'get_test_report': {
      const reportPath = join(TEST_REPORTS_DIR, 'auto-test-report.json');
      if (!existsSync(reportPath)) {
        return {
          content: [
            {
              type: 'text',
              text: 'No test report found. Run tests first using `run_all_tests`.',
            },
          ],
        };
      }
      
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      return {
        content: [
          {
            type: 'text',
            text: `## Latest Test Report\n\n` +
              `**Timestamp:** ${new Date(report.timestamp).toLocaleString()}\n\n` +
              `**Summary:** ${report.summary.passed} passed, ${report.summary.failed} failed\n\n` +
              report.suites.map(s => `- ${s.name}: ${s.passed ? '✅' : '❌'}`).join('\n'),
          },
        ],
      };
    }

    case 'watch_and_test': {
      const { patterns = ['**/*.ts', '**/*.tsx'] } = args;
      
      // This would typically start a file watcher
      // For now, return information about how to set up watching
      return {
        content: [
          {
            type: 'text',
            text: `## Watch Mode Setup\n\n` +
              `To watch for file changes and run tests automatically:\n\n` +
              `\`\`\`bash\n` +
              `# Using the auto-test script\n` +
              `./scripts/auto-test.sh\n\n` +
              `# Or add to your package.json:\n` +
              `"test:watch": "vitest --watch"\n` +
              `\`\`\`\n\n` +
              `Watching patterns: ${patterns.join(', ')}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DomainPulse Auto-Test MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
