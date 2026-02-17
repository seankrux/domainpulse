import React, { useState, useEffect } from 'react';
import { SiteLayout } from './components/SiteLayout';
import { ContentRenderer } from './components/ContentRenderer';
import { loadPage, loadPosts } from './lib/content';
import { ArrowRight, Calendar } from 'lucide-react';

type Page = 'home' | 'about' | 'blog' | 'contact' | 'post';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [pageContent, setPageContent] = useState<{ title: string; content: string; excerpt?: string } | null>(null);
  const [posts, setPosts] = useState<Array<{ slug: string; title: string; date: string; excerpt: string }>>([]);
  const [currentPost, setCurrentPost] = useState<{ slug: string; title: string; content: string; date: string; tags?: string[] } | null>(null);

  // Handle routing
  useEffect(() => {
    const handleRoute = async () => {
      const path = window.location.pathname.slice(1) || 'home';
      
      if (path === 'post') {
        const slug = new URLSearchParams(window.location.search).get('slug');
        if (slug) {
          const post = await loadPost(slug);
          if (post) {
            setCurrentPost(post);
            setCurrentPage('post');
            return;
          }
        }
      }
      
      // Load regular pages
      if (path === 'blog') {
        const loadedPosts = await loadPosts();
        setPosts(loadedPosts.map(p => ({
          slug: p.slug,
          title: p.title,
          date: p.date,
          excerpt: p.excerpt || ''
        })));
      }
      
      const page = await loadPage(path);
      if (page) {
        setPageContent({ title: page.title, content: page.content, excerpt: page.excerpt });
      } else {
        // Default content for pages without files
        setPageContent(getDefaultPage(path));
      }
      
      setCurrentPage(path as Page || 'home');
    };

    handleRoute();

    // Listen for navigation
    const onPopState = () => handleRoute();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (page: string, params?: Record<string, string>) => {
    let url = `/${page}`;
    if (params) {
      const search = new URLSearchParams(params).toString();
      url += `?${search}`;
    }
    window.history.pushState({}, '', url);
    window.dispatchEvent(new Event('popstate'));
  };

  if (currentPage === 'post' && currentPost) {
    return (
      <SiteLayout currentPage="blog">
        <ContentRenderer
          title={currentPost.title}
          content={currentPost.content}
          date={currentPost.date}
          tags={currentPost.tags}
        />
      </SiteLayout>
    );
  }

  if (currentPage === 'blog') {
    return (
      <SiteLayout currentPage="blog">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">Blog</h1>
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 mb-4">No posts yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Ask AI to create content or add posts manually to /content/posts/
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map(post => (
                <article
                  key={post.slug}
                  onClick={() => navigate('post', { slug: post.slug })}
                  className="group p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                    <Calendar size={14} />
                    <time dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{post.excerpt}</p>
                  <div className="mt-4 flex items-center text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                    Read more <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </SiteLayout>
    );
  }

  // Home, About, Contact pages
  return (
    <SiteLayout currentPage={currentPage}>
      {pageContent && (
        <ContentRenderer
          title={pageContent.title}
          content={pageContent.content}
          excerpt={pageContent.excerpt}
        />
      )}
    </SiteLayout>
  );
};

// Default content for pages without markdown files
function getDefaultPage(path: string) {
  const defaults: Record<string, { title: string; content: string; excerpt?: string }> = {
    home: {
      title: 'Welcome',
      excerpt: 'Building amazing things, one step at a time.',
      content: `# Welcome to Your Website

This is your **file-based CMS** website. No signup required, no complex setup.

## How It Works

1. **Content lives in files** - Markdown files in \`/content/pages/\` and \`/content/posts/\`
2. **Ask AI to create content** - Just say "create a blog post about X"
3. **Edit manually anytime** - Files are in your repo, edit in GitHub or locally

## Quick Start

- Edit this page: \`/content/pages/home.md\`
- Add a blog post: Create file in \`/content/posts/\`
- Deploy to Vercel: Push to GitHub, auto-deploys

## Features

- ✅ No CMS signup required
- ✅ AI can write content
- ✅ Full control over files
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Vercel ready
`
    },
    about: {
      title: 'About Us',
      content: `# About Us

Tell your story here. This page is perfect for:

- Company background
- Team introductions
- Mission and values
- Your journey

## Edit This Page

Create or edit \`/content/pages/about.md\` to customize this content.

### Example Content

\`\`\`markdown
# Our Story

Started in 2024, we've been building...

## Our Team

Meet the people behind the product...
\`\`\`
`
    },
    contact: {
      title: 'Contact',
      content: `# Get In Touch

We'd love to hear from you!

## Contact Information

- **Email:** hello@example.com
- **Location:** Your City, Country

## Reach Out

Fill out the form below or send us an email directly.

---

*Edit this page at \`/content/pages/contact.md\`*
`
    }
  };

  return defaults[path] || { title: 'Page Not Found', content: '# 404\n\nPage not found.' };
}

// Load single post helper
async function loadPost(slug: string) {
  try {
    const res = await fetch(`/content/posts/${slug}.md`);
    if (!res.ok) return null;
    
    const text = await res.text();
    const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      return { slug, title: slug, content: text, date: new Date().toISOString() };
    }

    const [, frontmatterStr, body] = frontmatterMatch;
    const frontmatter: Record<string, string> = {};
    
    frontmatterStr.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    });

    return {
      slug,
      title: frontmatter.title || slug,
      content: body.trim(),
      date: frontmatter.date || new Date().toISOString(),
      tags: frontmatter.tags?.split(',').map(t => t.trim())
    };
  } catch {
    return null;
  }
}

export default App;
