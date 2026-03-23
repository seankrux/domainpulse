import React from 'react';
import { markdownToHtml } from '../lib/content';

interface ContentRendererProps {
  title: string;
  content: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
}

export const ContentRenderer: React.FC<ContentRendererProps> = ({
  title,
  content,
  excerpt,
  date,
  tags
}) => {
  const html = markdownToHtml(content);

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          {title}
        </h1>
        {(date || tags?.length) && (
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            {date && (
              <time dateTime={date}>
                {new Date(date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
            )}
            {tags && tags.length > 0 && (
              <div className="flex gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {excerpt && (
        <p className="text-lg text-zinc-300 mb-8 leading-relaxed">
          {excerpt}
        </p>
      )}

      <div
        className="prose prose-invert max-w-none
          prose-headings:font-bold prose-headings:text-white
          prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
          prose-p:text-zinc-300 prose-p:leading-relaxed
          prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
          prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-300
          prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:rounded-lg prose-pre:border prose-pre:border-zinc-800
          prose-strong:text-white
          prose-ul:my-4 prose-ol:my-4
          prose-li:text-zinc-300"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
};
