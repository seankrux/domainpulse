# YourBrand Website

A modern, file-based CMS website built with React + Vite + Tailwind CSS. No signup required, no complex setup.

## Quick Start

### Run Locally

```bash
npm install
npm run dev:site
```

Open http://localhost:3002

### Build for Production

```bash
npm run build:site
npm run preview:site
```

## Deploy to Vercel

```bash
vercel
```

Or connect your GitHub repo to Vercel for auto-deploy on push.

---

## How It Works

Content lives in markdown files:

```
/content/
  ├── pages/          # Static pages
  │   ├── home.md
  │   ├── about.md
  │   └── contact.md
  └── posts/          # Blog posts
      ├── index.json  # Post listing
      └── post-1.md
```

### Create Content

**Ask AI to write content:**
```
"Create a blog post about our new product launch"
"Add an about page for my consulting business"
"Write a welcome post for the homepage"
```

**Or edit manually:**

Create `/content/posts/my-post.md`:
```markdown
---
title: My Blog Post
excerpt: A brief description of the post
date: 2026-02-17
tags: tech, update
author: Your Name
---

# Your Content Here

Write your blog post in markdown...
```

## Features

- ✅ **No CMS signup** - Content is just files in your repo
- ✅ **AI-editable** - Ask AI to create/update content
- ✅ **Full control** - Edit files directly in GitHub or locally
- ✅ **Dark mode** - Built-in dark/light theme toggle
- ✅ **Responsive** - Mobile-friendly design
- ✅ **Vercel ready** - One-click deployment

## File Structure

```
domainpulse/
├── content/              # Your content files
│   ├── pages/           # Static pages
│   └── posts/           # Blog posts
├── components/
│   ├── SiteLayout.tsx   # Main layout with nav/footer
│   └── ContentRenderer.tsx  # Markdown renderer
├── lib/
│   └── content.ts       # Content loading utilities
├── SiteApp.tsx          # Main app component
├── siteIndex.tsx        # Entry point
└── vite.site.config.ts  # Site build config
```

## Customization

### Change Branding

Edit `SiteLayout.tsx`:
- Change "YourBrand" to your name
- Update social links (GitHub, email)
- Modify navigation items

### Add Pages

1. Create markdown file in `/content/pages/`
2. Add to navigation in `SiteLayout.tsx`

### Styling

Uses Tailwind CSS. Customize in:
- `index.html` - Tailwind config
- Components - Direct className edits

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:site` | Start dev server (port 3002) |
| `npm run build:site` | Build for production |
| `npm run preview:site` | Preview production build |
| `npm run dev` | Original DomainPulse app |
| `npm run build` | Original DomainPulse build |

---

**Ready to build?** Just ask AI to create content or edit the markdown files directly!
