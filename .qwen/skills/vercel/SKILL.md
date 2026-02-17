# Vercel Development & Deployment

## Overview
This skill provides expertise in developing and deploying applications on Vercel, the platform for frontend frameworks and serverless functions.

## Core Knowledge

### Project Setup
- **Vercel CLI**: Install with `npm i -g vercel` for local development and deployment
- **Project Linking**: Use `vercel link` to connect local projects to Vercel projects
- **Environment Setup**: Sync environment variables with `vercel env pull`

### Deployment Methods

#### 1. Git Integration (Recommended)
- Connect GitHub/GitLab/Bitbucket repository
- Automatic deployments on push to configured branches
- Preview deployments for pull requests
- Production deployments on main/master branch

#### 2. Vercel CLI
```bash
vercel          # Deploy to preview
vercel --prod   # Deploy to production
```

#### 3. Dashboard
- Manual deployments via vercel.com dashboard
- Upload deployment artifacts directly

### Configuration (vercel.json)

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

### Environment Variables
- Use `.env.local` for local development
- Configure via Dashboard or CLI: `vercel env add KEY value`
- Scopes: `production`, `preview`, `development`
- Pull to local: `vercel env pull`

### Serverless Functions
- Place in `/api` directory
- Export handler function (Node.js, Python, Go, Ruby)
- Automatic scaling and zero cold starts for most use cases

```typescript
// api/hello.ts
export default function handler(req: Request, res: Response) {
  res.status(200).json({ message: 'Hello' });
}
```

### Edge Functions
- Run at the edge (closer to users)
- Use for middleware, A/B testing, authentication
- Configure in `vercel.json` or via `@vercel/edge`

### Custom Domains
- Add domains in Dashboard → Settings → Domains
- Configure DNS records (A, CNAME)
- Automatic HTTPS provisioning

### Build Process
1. **Install**: `npm install` (or configured install command)
2. **Build**: `npm run build` (or configured build command)
3. **Output**: Files from `outputDirectory` served statically

### Common Frameworks
| Framework | Output Directory | Build Command |
|-----------|------------------|---------------|
| Vite | `dist` | `npm run build` |
| Next.js | `.next` | `next build` |
| React (CRA) | `build` | `npm run build` |
| Vue | `dist` | `npm run build` |
| SvelteKit | `build` | `vite build` |

### Troubleshooting

#### Build Failures
- Check build logs in Dashboard
- Verify `vercel.json` configuration
- Test build locally: `vercel build`

#### Runtime Errors
- Check function logs: `vercel logs`
- Verify environment variables are set
- Check Node.js version compatibility

#### 404 on SPA Routes
- Add rewrites in `vercel.json` to redirect to `index.html`

### Best Practices
- Use Git integration for CI/CD
- Store secrets in Environment Variables, not code
- Use Preview deployments for testing
- Configure proper caching headers
- Monitor with Vercel Analytics
- Use `vercel.json` for consistent configuration

### Useful Commands
```bash
vercel login              # Authenticate
vercel link               # Link to project
vercel                    # Deploy preview
vercel --prod             # Deploy production
vercel env pull           # Sync env vars
vercel logs               # View deployment logs
vercel ls                 # List deployments
vercel rm <deployment>    # Remove deployment
```

## When to Use This Skill
- Setting up new Vercel projects
- Configuring deployments and build settings
- Troubleshooting deployment issues
- Implementing serverless/edge functions
- Managing environment variables
- Setting up custom domains and SSL
