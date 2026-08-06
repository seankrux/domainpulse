/**
 * Injected into the active tab to gather on-page SEO signals.
 * Returns a plain JSON-serializable audit object (or { ok:false, error }).
 */
(() => {
  try {
    const abs = (href) => {
      if (!href) return null;
      try {
        return new URL(href, document.baseURI).href;
      } catch {
        return null;
      }
    };

    const metaAll = (name) =>
      [...document.querySelectorAll('meta[name], meta[property]')]
        .filter((el) => {
          const n = (el.getAttribute('name') || el.getAttribute('property') || '').toLowerCase();
          return n === name.toLowerCase();
        })
        .map((el) => el.getAttribute('content'))
        .filter((c) => c != null);

    const meta = (name) => metaAll(name)[0] ?? null;

    const robotsParts = [...metaAll('robots'), ...metaAll('googlebot'), ...metaAll('bingbot')]
      .flatMap((c) =>
        String(c)
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      );
    const robotsMeta = robotsParts.length ? robotsParts.join(', ') : null;

    const canonicalEl = document.querySelector('link[rel~="canonical" i]');
    const canonical = abs(canonicalEl?.getAttribute('href'));

    const headings = {
      h1: [...document.querySelectorAll('h1')]
        .map((el) => el.textContent.trim())
        .filter(Boolean),
      h2Count: document.querySelectorAll('h2').length,
      h3Count: document.querySelectorAll('h3').length,
    };

    const images = [...document.querySelectorAll('img')];
    const imagesMissingAlt = images.filter((img) => !img.hasAttribute('alt')).length;

    const collectTypes = (node, out = []) => {
      if (node == null) return out;
      if (Array.isArray(node)) {
        for (const n of node) collectTypes(n, out);
        return out;
      }
      if (typeof node !== 'object') return out;
      const t = node['@type'];
      if (Array.isArray(t)) {
        for (const x of t) out.push(String(x).replace(/^https?:\/\/schema\.org\//, ''));
      } else if (t) {
        out.push(String(t).replace(/^https?:\/\/schema\.org\//, ''));
      }
      if (Array.isArray(node['@graph'])) collectTypes(node['@graph'], out);
      if (Array.isArray(node['@included'])) collectTypes(node['@included'], out);
      return out;
    };

    const jsonLdTypes = [];
    const jsonLdErrors = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        collectTypes(JSON.parse(s.textContent), jsonLdTypes);
      } catch {
        jsonLdErrors.push('invalid_jsonld');
      }
    }

    const og = {
      title: meta('og:title'),
      description: meta('og:description'),
      image: meta('og:image'),
      type: meta('og:type'),
      url: meta('og:url'),
    };

    const links = [...document.querySelectorAll('a[href]')];
    let internal = 0;
    let external = 0;
    let other = 0;
    for (const a of links) {
      try {
        const u = new URL(a.href, document.baseURI);
        if (!/^https?:$/i.test(u.protocol)) {
          other += 1;
        } else if (u.hostname === location.hostname) {
          internal += 1;
        } else {
          external += 1;
        }
      } catch {
        other += 1;
      }
    }

    const mainEl =
      document.querySelector('main, article, [role="main"]') || document.body;
    const wordCount = (mainEl?.innerText || '')
      .split(/\s+/)
      .filter(Boolean).length;

    const issues = [];
    const title = (document.title || '').trim();
    if (!title) {
      issues.push({ severity: 'error', code: 'missing_title', message: 'Missing <title>' });
    } else if (title.length < 30) {
      issues.push({
        severity: 'warn',
        code: 'short_title',
        message: `Title is short (${title.length} chars) — may underuse SERP space`,
      });
    } else if (title.length > 60) {
      issues.push({
        severity: 'warn',
        code: 'long_title',
        message: `Title may truncate in SERPs (${title.length} chars)`,
      });
    }

    const description = (meta('description') || '').trim() || null;
    if (!description) {
      issues.push({
        severity: 'error',
        code: 'missing_description',
        message: 'Missing meta description',
      });
    } else if (description.length < 70) {
      issues.push({
        severity: 'warn',
        code: 'short_description',
        message: `Description is short (${description.length} chars)`,
      });
    } else if (description.length > 160) {
      issues.push({
        severity: 'warn',
        code: 'long_description',
        message: `Description may truncate (${description.length} chars)`,
      });
    }

    if (!canonical) {
      issues.push({
        severity: 'warn',
        code: 'missing_canonical',
        message: 'No canonical link',
      });
    } else {
      try {
        const a = new URL(canonical);
        const b = new URL(location.href);
        a.hash = '';
        b.hash = '';
        const norm = (u) => {
          u.hostname = u.hostname.replace(/^www\./, '');
          if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
            u.pathname = u.pathname.slice(0, -1);
          }
          return u.origin + u.pathname + u.search;
        };
        if (norm(a) !== norm(b)) {
          issues.push({
            severity: 'info',
            code: 'canonical_differs',
            message: 'Canonical differs from current URL (after normalization)',
          });
        }
      } catch {
        issues.push({
          severity: 'warn',
          code: 'canonical_invalid',
          message: 'Canonical URL could not be parsed',
        });
      }
    }

    if (headings.h1.length === 0) {
      issues.push({ severity: 'error', code: 'missing_h1', message: 'No H1 found' });
    } else if (headings.h1.length > 1) {
      issues.push({
        severity: 'info',
        code: 'multiple_h1',
        message: `${headings.h1.length} H1 tags found`,
      });
    }

    if (robotsParts.some((p) => p === 'noindex' || p === 'none')) {
      issues.push({
        severity: 'error',
        code: 'noindex',
        message: `robots/googlebot contains noindex/none (${robotsMeta})`,
      });
    }

    if (imagesMissingAlt > 0) {
      issues.push({
        severity: 'warn',
        code: 'img_alt',
        message: `${imagesMissingAlt} image(s) missing alt`,
      });
    }

    if (!og.title || !og.description || !og.image) {
      issues.push({
        severity: 'info',
        code: 'og_incomplete',
        message: 'Open Graph tags incomplete (title/description/image)',
      });
    }

    for (const _ of jsonLdErrors) {
      issues.push({
        severity: 'warn',
        code: 'invalid_jsonld',
        message: 'Invalid JSON-LD script block',
      });
    }

    return {
      ok: true,
      url: location.href,
      title,
      titleLength: title.length,
      description,
      descriptionLength: description?.length ?? 0,
      canonical,
      robotsMeta,
      lang: document.documentElement.lang || null,
      headings,
      images: { total: images.length, missingAlt: imagesMissingAlt },
      links: { total: links.length, internal, external, other },
      wordCount,
      og,
      jsonLdTypes: [...new Set(jsonLdTypes)],
      issues,
      auditedAt: new Date().toISOString(),
      limitations:
        'Light DOM / main frame only. SPAs and shadow roots may be incomplete.',
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
})();
