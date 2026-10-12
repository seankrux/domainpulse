import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../../lib/content';

describe('markdownToHtml (XSS hardening)', () => {
  it('strips <script> injected through raw HTML', () => {
    const html = markdownToHtml('# Title\n\n<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
    expect(html).toContain('<h1');
  });

  it('strips event-handler attributes (onerror/onclick)', () => {
    const html = markdownToHtml('<img src=x onerror="alert(1)">');
    expect(html.toLowerCase()).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  it('neutralises javascript: URLs in links', () => {
    const html = markdownToHtml('[click](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('preserves safe markdown formatting', () => {
    const html = markdownToHtml('**bold** and [a link](https://example.com)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://example.com"');
  });

  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
  });
});
