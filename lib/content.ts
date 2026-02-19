import { marked } from 'marked';

/**
 * Simple content loader for file-based CMS
 * Reads markdown/JSON content files and returns structured data
 */

export interface ContentPage {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  date?: string;
  draft?: boolean;
}

export interface BlogPost extends ContentPage {
  date: string;
  tags?: string[];
  author?: string;
}

/**
 * Load all pages from /content/pages/
 * In production, this reads from bundled files
 */
export async function loadPages(): Promise<ContentPage[]> {
  try {
    const pages: ContentPage[] = [
      {
        slug: 'home',
        title: 'Home',
        content: '',
        excerpt: 'Welcome'
      },
      {
        slug: 'about',
        title: 'About',
        content: '',
        excerpt: 'About us'
      }
    ];

    // Try to load content files dynamically (dev mode)
    if (typeof window !== 'undefined') {
      // Browser: fetch from public folder
      try {
        const [homeRes, aboutRes] = await Promise.all([
          fetch('/content/pages/home.md').then(r => r.ok ? r.text() : null),
          fetch('/content/pages/about.md').then(r => r.ok ? r.text() : null)
        ]);

        if (homeRes) pages[0].content = parseMarkdownContent(homeRes);
        if (aboutRes) pages[1].content = parseMarkdownContent(aboutRes);
      } catch {
        // Fallback to defaults if files not found
      }
    }

    return pages;
  } catch (error) {
    console.error('Error loading pages:', error);
    return [];
  }
}

/**
 * Load a single page by slug
 */
export async function loadPage(slug: string): Promise<ContentPage | null> {
  const pages = await loadPages();
  return pages.find(p => p.slug === slug) || null;
}

/**
 * Load all blog posts from /content/posts/
 */
export async function loadPosts(): Promise<BlogPost[]> {
  try {
    const posts: BlogPost[] = [];

    if (typeof window !== 'undefined') {
      // Browser: fetch index.json that lists all posts
      try {
        const res = await fetch('/content/posts/index.json');
        if (res.ok) {
          const postList = await res.json();
          posts.push(...postList);
        }
      } catch {
        // No posts yet
      }
    }

    // Sort by date descending
    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error loading posts:', error);
    return [];
  }
}

/**
 * Load a single post by slug
 */
export async function loadPost(slug: string): Promise<BlogPost | null> {
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch(`/content/posts/${slug}.md`);
      if (res.ok) {
        const text = await res.text();
        return parseMarkdownPost(text, slug);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse markdown file with frontmatter
 */
function parseMarkdownPost(content: string, slug: string): BlogPost {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    return {
      slug,
      title: slug,
      content,
      date: new Date().toISOString()
    };
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
    excerpt: frontmatter.excerpt || body.slice(0, 150).trim() + '...',
    date: frontmatter.date || new Date().toISOString(),
    draft: frontmatter.draft === 'true',
    tags: frontmatter.tags?.split(',').map(t => t.trim()),
    author: frontmatter.author
  };
}

/**
 * Parse simple markdown content (title + body)
 */
function parseMarkdownContent(content: string): string {
  // Simple parsing - just return the content
  // Can be extended with a markdown library if needed
  return content;
}

/**
 * Convert markdown to HTML using 'marked' library
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  return marked.parse(markdown) as string;
}
