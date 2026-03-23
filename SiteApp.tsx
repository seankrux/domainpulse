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

    void handleRoute();

    // Listen for navigation
    const onPopState = () => void handleRoute();
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
          <h1 className="text-4xl font-bold text-white mb-8">Blog</h1>
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-400 mb-4">No posts yet</p>
              <p className="text-sm text-zinc-500">
                Ask AI to create content or add posts manually to /content/posts/
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map(post => (
                <article
                  key={post.slug}
                  onClick={() => navigate('post', { slug: post.slug })}
                  className="group p-6 bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 hover:border-emerald-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
                    <Calendar size={14} />
                    <time dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-zinc-400 line-clamp-2">{post.excerpt}</p>
                  <div className="mt-4 flex items-center text-emerald-400 text-sm font-medium">
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
      title: 'DomainPulse',
      excerpt: 'Professional domain monitoring and SSL tracking, built by Sean G.',
      content: `# Welcome to DomainPulse

Your **all-in-one domain monitoring dashboard**. Track uptime, SSL certificates, and get instant alerts when something goes wrong.

## What DomainPulse Does

1. **Monitors your domains** - Real-time uptime checks with latency tracking
2. **Tracks SSL certificates** - Know before your certs expire
3. **Sends alerts** - Browser notifications, Slack, and Discord webhooks
4. **Provides analytics** - Response time history and uptime percentages

## Key Features

- Real-time domain health monitoring
- SSL certificate expiry tracking
- Bulk domain import via CSV
- Dark mode support
- Keyboard shortcuts for power users
- Fully responsive design
`
    },
    about: {
      title: 'About',
      content: `# About DomainPulse

DomainPulse is a domain monitoring dashboard built by **Sean G** as a portfolio project.

## Tech Stack

- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Charts:** Recharts
- **Build Tool:** Vite 6
- **Deployment:** Vercel

## Why DomainPulse?

Managing multiple domains means keeping track of uptime, SSL certificates, and response times. DomainPulse brings all of that into one clean, fast dashboard.
`
    },
    contact: {
      title: 'Contact',
      content: `# Get In Touch

Interested in DomainPulse or want to collaborate?

## Connect

- **GitHub:** [github.com/seankrux](https://github.com/seankrux)
- **Email:** contact@domainpulse.app

Feel free to open an issue on GitHub or reach out directly.
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

    frontmatterStr?.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    });

    return {
      slug,
      title: frontmatter.title || slug,
      content: body?.trim() || '',
      date: frontmatter.date || new Date().toISOString(),
      tags: frontmatter.tags?.split(',').map(t => t.trim())
    };
  } catch {
    return null;
  }
}

export default App;
