import React, { useState, useEffect } from "react";
import { SiteLayout } from "./components/SiteLayout";
import { ContentRenderer } from "./components/ContentRenderer";
import { HeroSection } from "./components/sections/HeroSection";
import { FeaturesSection } from "./components/sections/FeaturesSection";
import { StatsSection } from "./components/sections/StatsSection";
import { HowItWorksSection } from "./components/sections/HowItWorksSection";
import { CTASection } from "./components/sections/CTASection";
import { loadPage, loadPosts } from "./lib/content";
import { Calendar, ArrowRight } from "lucide-react";

type Page = "home" | "about" | "blog" | "contact" | "post";

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [pageContent, setPageContent] = useState<{
    title: string;
    content: string;
    excerpt?: string;
  } | null>(null);
  const [posts, setPosts] = useState<
    Array<{ slug: string; title: string; date: string; excerpt: string }>
  >([]);
  const [currentPost, setCurrentPost] = useState<{
    slug: string;
    title: string;
    content: string;
    date: string;
    tags?: string[];
  } | null>(null);

  useEffect(() => {
    const handleRoute = async () => {
      const path = window.location.pathname.slice(1) || "home";

      if (path === "post") {
        const slug = new URLSearchParams(window.location.search).get("slug");
        if (slug) {
          const post = await loadPost(slug);
          if (post) {
            setCurrentPost(post);
            setCurrentPage("post");
            return;
          }
        }
      }

      if (path === "blog") {
        const loadedPosts = await loadPosts();
        setPosts(
          loadedPosts.map((p) => ({
            slug: p.slug,
            title: p.title,
            date: p.date,
            excerpt: p.excerpt || "",
          }))
        );
      }

      const page = await loadPage(path);
      if (page) {
        setPageContent({
          title: page.title,
          content: page.content,
          excerpt: page.excerpt,
        });
      } else {
        setPageContent(getDefaultPage(path));
      }

      setCurrentPage((path as Page) || "home");
    };

    void handleRoute();

    const onPopState = () => void handleRoute();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (page: string, params?: Record<string, string>) => {
    let url = `/${page}`;
    if (params) {
      const search = new URLSearchParams(params).toString();
      url += `?${search}`;
    }
    window.history.pushState({}, "", url);
    window.dispatchEvent(new Event("popstate"));
  };

  if (currentPage === "post" && currentPost) {
    return (
      <SiteLayout currentPage="blog">
        <div className="pt-20">
          <ContentRenderer
            title={currentPost.title}
            content={currentPost.content}
            date={currentPost.date}
            tags={currentPost.tags}
          />
        </div>
      </SiteLayout>
    );
  }

  if (currentPage === "blog") {
    return (
      <SiteLayout currentPage="blog">
        <div className="pt-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tighter text-white mb-8">
              Blog
            </h1>
            {posts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-zinc-400 mb-3">No posts yet</p>
                <p className="text-sm text-zinc-600">
                  Create a markdown file in{" "}
                  <code className="text-zinc-500">/content/posts/</code>
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {posts.map((post) => (
                  <article
                    key={post.slug}
                    onClick={() => navigate("post", { slug: post.slug })}
                    className="group p-5 sm:p-6 bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-zinc-800 hover:border-emerald-500/25 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono mb-2">
                      <Calendar size={12} />
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                    <h2 className="text-lg font-bold text-white mb-1.5 group-hover:text-emerald-400 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-zinc-500 text-sm line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="mt-3 flex items-center text-emerald-400 text-xs font-medium">
                      Read more{" "}
                      <ArrowRight
                        size={13}
                        className="ml-1 group-hover:translate-x-0.5 transition-transform"
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </SiteLayout>
    );
  }

  // Home page — rich composed sections
  if (currentPage === "home") {
    return (
      <SiteLayout currentPage="home">
        <HeroSection />
        <FeaturesSection />
        <StatsSection />
        <HowItWorksSection />
        <CTASection />
      </SiteLayout>
    );
  }

  // About, Contact — markdown rendered pages
  return (
    <SiteLayout currentPage={currentPage}>
      <div className="pt-20">
        {pageContent && (
          <ContentRenderer
            title={pageContent.title}
            content={pageContent.content}
            excerpt={pageContent.excerpt}
          />
        )}
      </div>
    </SiteLayout>
  );
};

function getDefaultPage(path: string) {
  const defaults: Record<
    string,
    { title: string; content: string; excerpt?: string }
  > = {
    about: {
      title: "About",
      content: `# About DomainPulse

DomainPulse is a domain monitoring dashboard built by **Sean G** as a portfolio project.

### Tech Stack

- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Charts:** Recharts
- **Build tool:** Vite 6
- **Deployment:** Vercel

### Why DomainPulse?

Managing multiple domains means keeping track of uptime, SSL certificates, and response times. DomainPulse brings all of that into one clean, fast dashboard.
`,
    },
    contact: {
      title: "Contact",
      content: `# Get in touch

Interested in DomainPulse or want to collaborate?

- **GitHub:** [github.com/seankrux](https://github.com/seankrux)
- **Email:** contact@domainpulse.app

Feel free to open an issue on GitHub or reach out directly.
`,
    },
  };

  return (
    defaults[path] || {
      title: "Not found",
      content: "# 404\n\nPage not found.",
    }
  );
}

async function loadPost(slug: string) {
  try {
    const res = await fetch(`/content/posts/${slug}.md`);
    if (!res.ok) return null;

    const text = await res.text();
    const frontmatterMatch = text.match(
      /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
    );

    if (!frontmatterMatch) {
      return {
        slug,
        title: slug,
        content: text,
        date: new Date().toISOString(),
      };
    }

    const [, frontmatterStr, body] = frontmatterMatch;
    const frontmatter: Record<string, string> = {};

    frontmatterStr?.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(":").trim();
      }
    });

    return {
      slug,
      title: frontmatter.title || slug,
      content: body?.trim() || "",
      date: frontmatter.date || new Date().toISOString(),
      tags: frontmatter.tags?.split(",").map((t) => t.trim()),
    };
  } catch {
    return null;
  }
}

export default App;
