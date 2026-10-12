import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadPage, loadPosts, loadPost, loadPages } from '../../lib/content';

const textRes = (body: string, ok = true) =>
  ({ ok, text: async () => body } as unknown as Response);
const jsonRes = (body: unknown, ok = true) =>
  ({ ok, json: async () => body } as unknown as Response);

beforeEach(() => {
  vi.mocked(fetch).mockReset();
});

describe('content loader', () => {
  it('loadPage finds a page by slug and returns null otherwise', async () => {
    vi.mocked(fetch).mockResolvedValue(textRes('# Home', false));
    expect((await loadPage('about'))?.slug).toBe('about');
    expect(await loadPage('nope')).toBeNull();
  });

  it('loadPages falls back to defaults when the markdown files are missing', async () => {
    vi.mocked(fetch).mockResolvedValue(textRes('', false));
    const pages = await loadPages();
    expect(pages.map(p => p.slug)).toContain('home');
    expect(pages.find(p => p.slug === 'home')?.excerpt).toBe('Welcome');
  });

  it('loadPost parses frontmatter (title/date/tags/draft/excerpt)', async () => {
    const md = [
      '---',
      'title: Hello World',
      'date: 2024-01-02',
      'tags: a, b , c',
      'draft: true',
      '---',
      'Body line one.',
      'Body line two.',
    ].join('\n');
    vi.mocked(fetch).mockResolvedValue(textRes(md));

    const post = await loadPost('hello');
    expect(post?.title).toBe('Hello World');
    expect(post?.date).toBe('2024-01-02');
    expect(post?.tags).toEqual(['a', 'b', 'c']);
    expect(post?.draft).toBe(true);
    expect(post?.content).toBe('Body line one.\nBody line two.');
  });

  it('loadPost falls back to slug/title when there is no frontmatter', async () => {
    vi.mocked(fetch).mockResolvedValue(textRes('just a body'));
    const post = await loadPost('plain');
    expect(post?.title).toBe('plain');
    expect(post?.content).toBe('just a body');
    // No frontmatter → draft is unset (falsy); equivalent to false for callers.
    expect(post?.draft).toBeFalsy();
  });

  it('loadPost returns null when the post file is not found', async () => {
    vi.mocked(fetch).mockResolvedValue(textRes('', false));
    expect(await loadPost('missing')).toBeNull();
  });

  it('loadPosts sorts newest-first and degrades to [] on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonRes([
        { slug: 'old', title: 'Old', date: '2020-01-01' },
        { slug: 'new', title: 'New', date: '2025-06-01' },
      ]),
    );
    const posts = await loadPosts();
    expect(posts.map(p => p.slug)).toEqual(['new', 'old']);

    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    expect(await loadPosts()).toEqual([]);
  });
});
