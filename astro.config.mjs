// @ts-check
import { defineConfig } from 'astro/config';

// Static Astro site for Cloudflare Pages.
// No adapter: default `output: 'static'` builds plain HTML/CSS/JS into dist/,
// which Pages serves directly. The contact endpoint is a separate Pages
// Function (functions/api/contact.ts), NOT an Astro SSR route.
export default defineConfig({
  site: 'https://jayde.io',
  // One trailing-slash policy: canonical URLs never end in a slash.
  trailingSlash: 'never',
  build: {
    // Emit flat files (blog.html served at /blog) so Cloudflare Pages serves
    // clean, extensionless, no-trailing-slash URLs.
    format: 'file',
    // Inline tiny stylesheets to cut render-blocking requests on a small site.
    inlineStylesheets: 'auto',
  },
  // Sharp is the default image service; Picture/Image emit AVIF/WebP at build.
  devToolbar: { enabled: false },
});
