# GitHub Development & CI/CD

## Overview
This skill provides expertise in GitHub workflows, Actions, repository management, and CI/CD pipelines for modern development.

## Core Knowledge

### Repository Setup

#### Initialize & Clone
```bash
git init                          # Initialize new repo
git clone <url>                   # Clone existing repo
git clone <url> <folder>          # Clone to specific directory
```

#### Remote Configuration
```bash
git remote add origin <url>       # Add remote
git remote -v                     # List remotes
git remote set-url origin <url>   # Change remote URL
```

### Branching Strategy

#### Common Workflows
- **GitHub Flow**: `main` branch + feature branches with PRs
- **Git Flow**: `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`
- **Trunk-Based**: Short-lived feature branches, frequent merges to `main`

#### Branch Commands
```bash
git branch                        # List branches
git branch -a                     # List all (including remote)
git checkout -b <branch>          # Create and switch
git checkout <branch>             # Switch branch
git branch -d <branch>            # Delete local branch
git push origin --delete <branch> # Delete remote branch
```

### Commit Best Practices

#### Conventional Commits
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`

**Examples**:
```
feat(auth): add OAuth2 login support
fix(api): resolve null pointer in user endpoint
docs: update README with setup instructions
```

### Pull Requests

#### PR Workflow
1. Create feature branch from `main`
2. Make commits with clear messages
3. Push branch: `git push -u origin <branch>`
4. Open PR on GitHub
5. Request reviewers
6. Address feedback
7. Merge (squash, rebase, or merge commit)

#### PR Best Practices
- Keep PRs small and focused
- Write descriptive titles and descriptions
- Link related issues (`Closes #123`)
- Add reviewers and labels
- Ensure CI checks pass before requesting review

### GitHub Actions

#### Workflow Structure
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run lint
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
```

#### Common Triggers
```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  workflow_dispatch:     # Manual trigger
  release:
    types: [published]
```

#### Environment Variables & Secrets
```yaml
env:
  NODE_ENV: production

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./deploy.sh
        env:
          API_KEY: ${{ secrets.API_KEY }}
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

#### Matrix Builds
```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm test
```

#### Job Dependencies & Outputs
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - id: version
        run: echo "version=1.0.0" >> $GITHUB_OUTPUT
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying version ${{ needs.build.outputs.version }}"
```

### Common Actions

#### Official Actions
```yaml
actions/checkout@v4           # Checkout code
actions/setup-node@v4         # Setup Node.js
actions/setup-python@v5      # Setup Python
actions/upload-artifact@v4    # Upload build artifacts
actions/download-artifact@v4  # Download artifacts
actions/cache@v4              # Cache dependencies
actions/github-script@v7      # Run GitHub API scripts
```

#### Popular Community Actions
```yaml
npm ci && npm test            # Install and test
vercel deploy --prod          # Deploy to Vercel
aws-actions/configure-aws     # AWS credentials
docker/build-push-action      # Build and push Docker
```

### GitHub Pages

#### Static Site Deployment
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run build
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      
      - name: Deploy
        uses: actions/deploy-pages@v4
```

### Repository Settings

#### Branch Protection Rules
- Require PR reviews before merging
- Require status checks to pass
- Require signed commits
- Prevent force pushes
- Prevent deletion

#### Required Status Checks
- Configure CI checks that must pass
- Set as required in branch protection

### GitHub API & CLI

#### GitHub CLI (gh)
```bash
gh auth login                 # Authenticate
gh repo create                # Create repository
gh pr create                  # Create pull request
gh pr list                    # List PRs
gh pr merge <number>          # Merge PR
gh issue create               # Create issue
gh issue list                 # List issues
gh run list                   # List workflow runs
gh run view                   # View workflow run
gh run rerun                  # Re-run workflow
```

### Release Management

#### Manual Releases
1. Create version tag: `git tag v1.0.0`
2. Push tag: `git push origin v1.0.0`
3. Create release on GitHub with changelog

#### Automated Releases
```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
```

### Security

#### Dependabot
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

#### Secret Scanning
- GitHub automatically scans for exposed secrets
- Enable push protection to prevent commits with secrets

### Best Practices

#### General
- Use meaningful commit messages
- Keep branches short-lived
- Review code before merging
- Use PR templates for consistency
- Automate repetitive tasks with Actions

#### CI/CD
- Cache dependencies to speed up builds
- Use matrix builds for compatibility testing
- Fail fast on errors
- Keep workflows modular and reusable
- Use environments for deployment stages

#### Security
- Never commit secrets or API keys
- Use Dependabot for dependency updates
- Enable branch protection on main
- Review third-party actions before use
- Use OIDC for cloud provider authentication

### Useful Commands Reference

```bash
# Git basics
git status                    # Check status
git log --oneline --graph     # View commit history
git diff                      # See changes
git stash                     # Stash changes
git stash pop                 # Restore stashed changes

# Remote operations
git fetch                     # Fetch remote changes
git pull                      # Fetch and merge
git push                      # Push changes
git push -u origin <branch>   # Push and set upstream

# Undo operations
git reset --soft HEAD~1       # Undo commit, keep changes
git reset --hard HEAD~1       # Undo commit, discard changes
git revert <commit>           # Create reverse commit
git commit --amend            # Amend last commit

# GitHub CLI
gh pr checkout <number>       # Checkout PR branch
gh pr diff <number>           # View PR diff
gh workflow run <name>        # Trigger workflow
```

## When to Use This Skill
- Setting up new GitHub repositories
- Creating CI/CD pipelines with Actions
- Configuring automated deployments
- Managing pull requests and code reviews
- Setting up branch protection and security
- Automating releases and versioning
- Integrating with Vercel, AWS, or other platforms
