import type { APIRoute } from 'astro';
import { SITE, SITEMAP_ROUTES } from '../data/site';

// Only canonical, indexable pages that return 200. Redirects, the retired page,
// the API, and error pages are excluded.
export const GET: APIRoute = () => {
  const urls = SITEMAP_ROUTES.map(
    (r) =>
      `  <url>\n    <loc>${SITE.origin}${r.path}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <priority>${r.priority}</priority>\n  </url>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
