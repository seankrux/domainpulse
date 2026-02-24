---
name: project-auditor
description: Audit and list all projects in a directory tree. Identifies project types, documentation status, initialization files, and AI-management markers (e.g. .qwen, .claudecodex). Use when the user asks for a "list of all projects" or a "bird's eye view" of their work.
---

# Project Auditor

This skill allows you to scan a directory (or multiple directories) to identify software projects and audit their health (documentation, init files, AI alignment).

## Workflows

### List and Audit Projects

To show a list of all projects, run the `scan_projects.cjs` script on the target directory.

```bash
node {{skill_path}}/scripts/scan_projects.cjs [target_directory]
```

- **Project Markers:** Looks for `package.json`, `.git`, `requirements.txt`, etc.
- **AI Markers:** Identifies if a project is managed by AI by looking for `.qwen`, `.claudecodex`, `.cursorrules`, `GEMINI.md`, etc.
- **Documentation Audit:** Checks for the existence of `README.md` or a `docs/` folder.

## Optimization & Meta-Cognition

- If a project is missing documentation (❌ in Docs column), suggest generating a `README.md` based on the codebase.
- If a project lacks AI markers (👤 in AI Managed column), suggest adding a `GEMINI.md` context file to improve AI collaboration.
- For a bird's eye view, use the table output to summarize the status of the entire workspace.
