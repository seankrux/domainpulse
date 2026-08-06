/**
 * Injected into the active tab to gather on-page SEO signals.
 * Returns a plain JSON-serializable audit object.
 */
(() => {
  const abs = (href) => {
    if (!href) return null;
    try {
      return new URL(href, document.baseURI).href;
    } catch {
      return href;
    }
  };

  const meta = (name) => {
    const byName = document.querySelector(`meta[name="${name}" i]`);
    if (byName) return byName.getAttribute('content');
    const byProp = document.querySelector(`meta[property="${name}" i]`);
    return byProp?.getAttribute('content') ?? null;
  };

  const robotsMeta = meta('robots') || meta('googlebot');
  const canonical = abs(
    document.querySelector('link[rel="canonical"]')?.getAttribute('href')
  );

  const headings = {
    h1: [...document.querySelectorAll('h1')].map((el) => el.textContent.trim()).filter(Boolean),
    h2Count: document.querySelectorAll('h2').length,
    h3Count: document.querySelectorAll('h3').length,
  };

  const images = [...document.querySelectorAll('img')];
  const imagesMissingAlt = images.filter((img) => !img.hasAttribute('alt')).length;

  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => {
      try {
        return JSON.parse(s.textContent);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const og = {
    title: meta('og:title'),
    description: meta('og:description'),
    image: meta('og:image'),
    type: meta('og:type'),
    url: meta('og:url'),
  };

  const twitter = {
    card: meta('twitter:card'),
    title: meta('twitter:title'),
    description: meta('twitter:description'),
  };

  const links = [...document.querySelectorAll('a[href]')];
  const internal = links.filter((a) => {
    try {
      return new URL(a.href).hostname === location.hostname;
    } catch {
      return false;
    }
  }).length;

  const wordCount = (document.body?.innerText || '')
    .split(/\s+/)
    .filter(Boolean).length;

  const issues = [];
  const title = document.title || '';
  if (!title) issues.push({ severity: 'error', code: 'missing_title', message: 'Missing <title>' });
  else if (title.length < 30) issues.push({ severity: 'warn', code: 'short_title', message: `Title is short (${title.length} chars)` });
  else if (title.length > 60) issues.push({ severity: 'warn', code: 'long_title', message: `Title may truncate (${title.length} chars)` });

  const description = meta('description');
  if (!description) issues.push({ severity: 'error', code: 'missing_description', message: 'Missing meta description' });
  else if (description.length < 70) issues.push({ severity: 'warn', code: 'short_description', message: `Description is short (${description.length} chars)` });
  else if (description.length > 160) issues.push({ severity: 'warn', code: 'long_description', message: `Description may truncate (${description.length} chars)` });

  if (!canonical) issues.push({ severity: 'warn', code: 'missing_canonical', message: 'No canonical link' });
  else if (canonical.split('#')[0] !== location.href.split('#')[0]) {
    issues.push({
      severity: 'info',
      code: 'canonical_differs',
      message: 'Canonical differs from current URL',
    });
  }

  if (headings.h1.length === 0) issues.push({ severity: 'error', code: 'missing_h1', message: 'No H1 found' });
  if (headings.h1.length > 1) issues.push({ severity: 'warn', code: 'multiple_h1', message: `${headings.h1.length} H1 tags found` });

  if (robotsMeta && /noindex/i.test(robotsMeta)) {
    issues.push({ severity: 'error', code: 'noindex', message: `robots meta contains noindex (${robotsMeta})` });
  }

  if (imagesMissingAlt > 0) {
    issues.push({
      severity: 'warn',
      code: 'img_alt',
      message: `${imagesMissingAlt} image(s) missing alt`,
    });
  }

  if (!og.title || !og.description) {
    issues.push({ severity: 'info', code: 'og_incomplete', message: 'Open Graph tags incomplete' });
  }

  return {
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
    links: { total: links.length, internal, external: links.length - internal },
    wordCount,
    og,
    twitter,
    jsonLdTypes: jsonLd.flatMap((node) => {
      const t = node['@type'];
      if (Array.isArray(t)) return t;
      if (t) return [t];
      if (Array.isArray(node['@graph'])) {
        return node['@graph'].flatMap((g) => (g['@type'] ? [g['@type']] : []));
      }
      return [];
    }),
    issues,
    auditedAt: new Date().toISOString(),
  };
})();
