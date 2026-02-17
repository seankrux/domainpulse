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
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
          {title}
        </h1>
        {(date || tags?.length) && (
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
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
                    className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded text-xs font-medium"
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
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
          {excerpt}
        </p>
      )}

      <div
        className="prose prose-slate dark:prose-invert max-w-none
          prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white
          prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
          prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed
          prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
          prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg
          prose-strong:text-slate-900 dark:prose-strong:text-white
          prose-ul:my-4 prose-ol:my-4
          prose-li:text-slate-700 dark:prose-li:text-slate-300"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
};
