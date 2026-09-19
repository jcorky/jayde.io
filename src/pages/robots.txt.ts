import type { APIRoute } from 'astro';
import { SITE } from '../data/site';

// Allow all public content and assets. Any noindex pages stay crawlable so
// crawlers can actually read the noindex directive.
export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE.origin}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
