const fs = require('fs');
const path = require('path');

const PROJECT_MARKERS = [
  'package.json',
  'requirements.txt',
  'go.mod',
  '.git',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'App.tsx',
  'App.js'
];

const AI_MARKERS = [
  '.qwen',
  '.claudecodex',
  '.cursorrules',
  '.windsurfrules',
  'GEMINI.md',
  'ai-instructions.md',
  '.ai'
];

const DOC_MARKERS = [
  'README.md',
  'readme.md',
  'DOCUMENTATION.md',
  'docs/'
];

function isProject(dir) {
  try {
    const files = fs.readdirSync(dir);
    return PROJECT_MARKERS.some(marker => files.includes(marker));
  } catch (e) {
    return false;
  }
}

function auditProject(dir) {
  const files = fs.readdirSync(dir);
  const hasDocs = DOC_MARKERS.some(marker => {
    if (marker.endsWith('/')) {
      return files.includes(marker.slice(0, -1)) && fs.statSync(path.join(dir, marker)).isDirectory();
    }
    return files.includes(marker);
  });
  
  const aiManaged = AI_MARKERS.some(marker => files.includes(marker));
  const hasInit = files.includes('package.json') || files.includes('requirements.txt') || files.includes('.git');

  return {
    name: path.basename(dir),
    path: dir,
    hasDocs,
    hasInit,
    aiManaged
  };
}

function scan(root, depth = 0, maxDepth = 3) {
  const results = [];
  if (depth > maxDepth) return results;

  try {
    const files = fs.readdirSync(root);
    
    if (isProject(root)) {
      results.push(auditProject(root));
      // Once a project is found, we don't usually look for sub-projects unless they are monorepos
      // For now, let's stop recursion here to avoid listing every subfolder as a project.
      return results;
    }

    for (const file of files) {
      const fullPath = path.join(root, file);
      if (fs.statSync(fullPath).isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'venv') {
        results.push(...scan(fullPath, depth + 1, maxDepth));
      }
    }
  } catch (e) {
    // Ignore errors (e.g. permission denied)
  }

  return results;
}

const rootDir = process.argv[2] || process.cwd();
console.log(`Scanning projects in: ${rootDir}
`);

const projects = scan(rootDir);

if (projects.length === 0) {
  console.log('No projects found.');
} else {
  console.log('| Project Name | Path | Docs | Init | AI Managed |');
  console.log('| :--- | :--- | :--- | :--- | :--- |');
  projects.forEach(p => {
    console.log(`| ${p.name} | ${p.path} | ${p.hasDocs ? '✅' : '❌'} | ${p.hasInit ? '✅' : '❌'} | ${p.aiManaged ? '🤖' : '👤'} |`);
  });
}
