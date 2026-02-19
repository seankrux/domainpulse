const fs = require('fs');
const path = require('path');

const DANGEROUS_PATTERNS = [
  { regex: /rm\s+-rf\s+\//, name: 'Root deletion' },
  { regex: /curl\s+-X\s+POST/, name: 'External POST request' },
  { regex: /process\.env/, name: 'Environment variable access' },
  { regex: /eval\(/, name: 'Dynamic code execution' },
  { regex: /child_process/, name: 'Subprocess execution' },
  { regex: /localStorage\.setItem/, name: 'Storage mutation' },
  { regex: /fetch\(|http\.request|https\.request/, name: 'Network request' },
  { regex: /chmod\s+777/, name: 'Weak permissions' },
  { regex: />\s*\/dev\/null/, name: 'Output suppression (potential stealth)' }
];

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  DANGEROUS_PATTERNS.forEach(pattern => {
    if (pattern.regex.test(content)) {
      issues.push(`⚠️  ${pattern.name} found in ${path.basename(filePath)}`);
    }
  });

  return issues;
}

function auditSkill(skillDir) {
  const issues = [];
  const files = [];

  function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        if (file !== 'node_modules') walk(fullPath);
      } else {
        files.push(fullPath);
      }
    });
  }

  try {
    walk(skillDir);
    files.forEach(file => {
      if (file.endsWith('.cjs') || file.endsWith('.js') || file.endsWith('.md') || file.endsWith('.sh')) {
        issues.push(...auditFile(file));
      }
    });
  } catch (e) {
    issues.push(`❌ Error accessing directory: ${e.message}`);
  }

  return issues;
}

const targetDir = process.argv[2];
if (!targetDir) {
  console.log('Usage: node audit_skill.cjs <path_to_skill_directory>');
  process.exit(1);
}

console.log(`Auditing skill at: ${targetDir}\n`);
const findings = auditSkill(targetDir);

if (findings.length === 0) {
  console.log('✅ No suspicious patterns found. Skill appears safe.');
} else {
  console.log('Findings:');
  findings.forEach(f => console.log(f));
  console.log('\n🚫 SECURITY RISK: Review the findings above before proceeding.');
}
