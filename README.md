# Jayde.IO

Personal website for **Jayde Cork — Technical Trainer**. A static [Astro](https://astro.build) site
deployed to **Cloudflare Pages**, with a serverless contact endpoint (Cloudflare Pages Function →
[Resend](https://resend.com)) protected by [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/).

It recreates the original Canva design in maintainable code: the dark maritime/space identity, the
Saturn + halftone `JAYDE.IO` wordmark, pixel-art flame/heart, port photography, olive Blog surface,
Panama page, and the cream contact panel.

---

## Tech stack & tested versions

| Tool | Version | Notes |
| --- | --- | --- |
| Astro | `^7.2.1` | Static output (`output: 'static'`), **no** Cloudflare adapter needed |
| Node.js | `22.16.0` | Pinned in `.nvmrc` / `.node-version`; Astro 7 needs ≥ 22.12 |
| Fonts | `@fontsource/antonio`, `@fontsource/public-sans` | Self-hosted, bundled into `dist/` |
| Images | `sharp` | Build-time AVIF/WebP responsive derivatives via `<Image>`/`<Picture>` |
| Email | Resend HTTPS API | Called server-side from the Pages Function (no SDK) |
| Anti-spam | Cloudflare Turnstile | Client widget + server-side siteverify |
| Local runtime | `wrangler` `^4.40` | `wrangler pages dev` runs the static build **and** the Function |

## Project layout

```
astro.config.mjs        # static site, trailingSlash: 'never', build.format: 'file'
src/
  data/site.ts          # ALL content: nav, biography, skills, résumé, per-page SEO, sitemap routes
  data/schema.ts        # JSON-LD builders (Person, WebSite, ProfilePage, BreadcrumbList)
  styles/               # tokens.css (palette + type scale), global.css, print.css
  layouts/SiteLayout.astro
  components/           # SEO, Header (nav + mobile menu), Footer, Banner, ContactForm
  assets/images/*.jpg   # source photos — optimised by Astro at build
  pages/                # index, blog, panama, skills, resume, contact, 404, sitemap.xml.ts, robots.txt.ts
functions/api/contact.ts# POST /api/contact — validation, Turnstile, Resend, rate limit
public/                 # favicon/OG/manifest, pixel art (img/), _redirects, _headers, _routes.json
test/contact.test.ts    # unit tests for the contact Function (mocked fetch)
```

## Local development

```bash
npm install
npm run dev            # Astro dev server (fast; does NOT run the contact Function)
```

To exercise the **contact Function** and static redirects/headers locally, build then serve with Wrangler:

```bash
npm run build         # -> dist/
npm run pages:dev     # wrangler pages dev dist  (serves site + /api/contact)
```

Local secrets go in **`.dev.vars`** (git-ignored). Copy `.env.example` for the full list. The committed
example uses Cloudflare's public **test** Turnstile keys, which always pass on any host including
`localhost`, so the widget works offline. `npm test` runs the Function's unit tests.

---

## 1 · Updating content

All copy lives in **`src/data/site.ts`** — edit there, never in the page templates.

- **Biography** — `BIO_PARAGRAPHS` (array of paragraphs, shown on the home "Who I Am" section).
- **Skills** — `SKILLS` (title + body per card on `/skills`).
- **Résumé** — `RESUME` (summary, experience, earlier-career, core skills). Verified facts only.
  - Draft/optional fields (employment dates, education, certifications, profile URLs, achievements,
    a real PDF path) live in **`RESUME_DRAFTS`** and are intentionally **not** rendered until filled in
    with verified content. See *Missing résumé details* below.
- **Per-page titles/descriptions** — `PAGE_META`.
- **Sitemap** — `SITEMAP_ROUTES` (path + `lastmod` + priority). Update `lastmod` only when a page's
  content actually changes.

### Images

Drop new source photos in `src/assets/images/` and reference them with Astro's `<Image>`/`<Picture>`
(see any page for the pattern) so they get responsive AVIF/WebP derivatives and explicit dimensions.
Pixel art and the wordmark are in `public/img/` (served as-is). Do **not** hotlink Canva URLs.

### Blog posts (future)

`/blog` currently shows two cards (Panama → `/panama`; Seaboard → *Coming soon*, noninteractive).
The Panama template (`src/pages/panama.astro`) is ready for real content. When you add a real Panama
article: remove `noindex`, add the page to `SITEMAP_ROUTES`, and add `Article`/`BlogPosting` JSON-LD.
When a real Seaboard article exists, make its card a link and replace the low-res image.

---

## 2 · Routes & redirects

| Route | Purpose | Indexable |
| --- | --- | --- |
| `/` | Home + biography | ✅ |
| `/blog` | Blog / project stories | ✅ |
| `/panama` | Panama 2026 (placeholder) | ❌ `noindex,follow`, excluded from sitemap |
| `/skills` | Skills | ✅ |
| `/resume` | Résumé | ✅ |
| `/contact` | Contact form | ✅ |
| `/404.html` | Genuine 404 | ❌ |
| `POST /api/contact` | Email endpoint (Pages Function) | ❌ |

**Redirects**
- `public/_redirects`: `/page-3 → /contact` (301). `/page-5` is **retired** → real 404 (no redirect).
- Legacy Canva hash links are mapped **client-side** (fragments never reach the server), in
  `SiteLayout.astro`: `/#page-0 → /`, `/#page-1 → /blog`, `/#page-2 → /contact`.
- **Host redirects** (`www` and `*.pages.dev` → `https://jayde.io`) can't be done in `_redirects`
  (it matches path only). Configure them as **Cloudflare Redirect Rules** on the zone (see Deploy §).
- URL policy: **no trailing slash** (Pages redirects `/contact/` and `/contact.html` → `/contact`).

---

## 3 · Secrets & environment

Never commit real values. Set these in **Cloudflare Pages → Settings → Environment variables**
(Production and Preview separately). See `.env.example` for descriptions.

| Name | Scope | Purpose |
| --- | --- | --- |
| `PUBLIC_TURNSTILE_SITE_KEY` | Build-time, public | Turnstile widget site key (baked into the static form) |
| `RESEND_API_KEY` | Runtime secret | Resend API key (encrypted) |
| `TURNSTILE_SECRET_KEY` | Runtime secret | Turnstile secret (encrypted) |
| `CONTACT_TO` | Runtime | Fixed recipient — `Jayde.cork@gmail.com` |
| `CONTACT_FROM` | Runtime | Verified sender — `Jayde.IO <website@jayde.io>` |
| `ALLOWED_HOSTNAMES` | Runtime | Comma list for origin + Turnstile hostname checks |
| `RATE_LIMIT` | Runtime binding *(optional)* | KV namespace to enable a best-effort per-IP rate limiter |

> The recipient and sender are **fixed on the server**. A browser field can never choose them.

### Resend sending-domain setup (required for real delivery)

1. Add domain **`jayde.io`** in Resend → **Domains**.
2. Create the DNS records Resend shows (copy the exact values — the SES region varies):
   - **MX** on `send` → `feedback-smtp.<region>.amazonses.com` (priority 10)
   - **TXT (SPF)** on `send` → `v=spf1 include:amazonses.com ~all`
   - **TXT (DKIM)** on `resend._domainkey` → `p=…`
   - *(Recommended)* **TXT (DMARC)** on `_dmarc` → `v=DMARC1; p=none;`
   If DNS is on Cloudflare, set these records to **DNS only** (grey cloud).
3. Wait for Resend to mark the domain **Verified**, then the form can send from `website@jayde.io`.
   Gmail is only the *destination*; this does **not** use Jayde's Gmail password.

### Turnstile setup

Create a Turnstile widget (Managed) for hostnames `jayde.io`, `www.jayde.io`, and your `*.pages.dev`
preview host. Put the **site key** in `PUBLIC_TURNSTILE_SITE_KEY` and the **secret** in
`TURNSTILE_SECRET_KEY`. The widget uses `data-action="contact"`, which the server enforces.

---

## 4 · Email testing results

| Check | Status |
| --- | --- |
| Endpoint routing, method (`POST` only), content-type, body-size limits | ✅ verified (`wrangler pages dev` + curl) |
| Field validation (name 1–100, email ≤254 + format, message 1–5000), CR/LF rejection | ✅ verified (unit tests) |
| Honeypot, origin check, missing-config → 500 (no fake success) | ✅ verified |
| Turnstile server-side siteverify + hostname/action enforcement | ✅ verified (test keys + unit tests) |
| Resend request shape (endpoint, bearer auth, `reply_to` snake_case, idempotency key, escaped HTML) | ✅ verified (Resend returned a well-formed 401 for the placeholder key; success path unit-tested with mocked fetch) |
| Provider/network failure → error state, **not** fake success; inputs preserved; no duplicate sends | ✅ verified end-to-end in the browser |
| **Real send to Jayde.cork@gmail.com + inbox receipt + Reply-To** | ⏳ **UNVERIFIED** — requires a real `RESEND_API_KEY` and a verified `jayde.io` sending domain (owner-only). |

**To complete verification:** add the real secrets + verified domain, deploy a preview, submit the form
once, confirm the message arrives in the Gmail inbox/spam, and confirm **Reply** goes to the sender's
address. Until then, treat inbox delivery as unverified.

---

## 5 · SEO & search-engine setup

- Unique `<title>` + description per page; self-referencing canonicals on `https://jayde.io`.
- Open Graph + Twitter cards; share image `public/og.png` (1200×630, with alt text).
- JSON-LD: `Person`, `WebSite`, `ProfilePage` (résumé), `BreadcrumbList`. No invented profiles/awards/dates.
- `sitemap.xml` — Home, Blog, Skills, Résumé, Contact only (Panama/404/API excluded).
- `robots.txt` allows all + points to the sitemap; noindex pages stay crawlable.

**After deploy:**
1. Verify the production site in **Google Search Console** and **Bing Webmaster Tools** (owner access
   required — DNS TXT or the HTML-file method). Submit `https://jayde.io/sitemap.xml` in both.
2. Inspect key URLs; confirm production is **not** inheriting a preview `noindex`.
3. *(Optional, Bing)* **IndexNow**: host a key file at `https://jayde.io/<key>.txt` and submit only
   added/changed/removed **production** URLs after a successful deploy. Never submit previews. Keep the
   sitemap regardless.

No ranking or indexing is guaranteed.

---

## 6 · Deploying to Cloudflare Pages

1. Push this repo to GitHub (`jcorky/jayde.io`) and connect it in **Cloudflare Pages → Create project → Git**.
2. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Node is pinned by `.nvmrc` (`22.16.0`).
3. Add the environment variables/secrets from §3 (Production **and** Preview).
4. `functions/api/contact.ts` deploys automatically; `public/_routes.json` scopes Functions to `/api/*`
   so all other paths are served as static assets.
5. **Custom domain:** add `jayde.io` in Pages → *Custom domains* **before** changing DNS. If moving the
   apex to Cloudflare nameservers, preserve existing unrelated records (especially **MX/mail**).
6. **Single hostname:** add **Redirect Rules** to send `www.jayde.io` and `<project>.pages.dev` →
   `https://jayde.io` (preserving path + query). Keep branch previews working and excluded from indexing.
7. **Rate limiting** (recommended): add a Cloudflare **Rate Limiting Rule** on `/api/contact`, or bind a
   KV namespace named `RATE_LIMIT` to enable the Function's built-in per-IP limiter.

**Rollback:** Pages → Deployments → *Rollback* to a previous successful deployment.

Security headers live in `public/_headers` (CSP allowing Turnstile + self-hosted assets, HSTS, nosniff,
frame-deny, referrer + permissions policy). They apply to static assets; the Function sets its own
headers (incl. `Cache-Control: no-store`) in code.

---

## 7 · Verification performed & notes

**Checks run** (see also the commit history and `test/`):
- `astro check` — 0 errors. `npm test` — contact Function unit tests pass.
- Every page built to static HTML; all body/résumé text present in the initial HTML.
- Routing verified via Wrangler: all pages 200; `/page-3 → /contact` (301); `/page-5` → 404; unknown → 404;
  `/contact.html` → `/contact`.
- Contact endpoint: validation, honeypot, origin, Turnstile, provider-failure, and end-to-end browser
  submission (error state on placeholder key — no fake success).
- Visual comparison of every page against the supplied references at desktop (1366) and mobile (375):
  no horizontal overflow, accessible mobile menu, circular portrait, high-contrast submit button.

### Asset & font substitutions
- **Wordmark** (`Rig Solid Bold Halftone`) is preserved as a **transparent PNG** extracted from the
  source (no large display webfont loaded for one word).
- **Headings** use **Antonio** (self-hosted, matches the reference).
- **Body / Panama / footer** use **Public Sans** (self-hosted). This substitutes the reference's
  **Telegraf** (body) — a commercial font not licensable as a webfont — and consolidates the footer's
  *Open Sauce* into one body family for performance. Nav uses the system **Arial** stack, as in the source.
- Pixel-art **flame** and **heart** are extracted from the source as transparent PNGs (not emoji).

### Missing / owner-only items
- **Résumé drafts:** employment dates, education, certifications, professional-profile URLs (e.g.
  LinkedIn), and achievements are left blank in `RESUME_DRAFTS` and not shown. Fill them with verified
  facts to surface them; add a real PDF only if generated from the same content.
- **Seaboard image** is the live site's low-res `201×251` file (documented as such). Replace with an
  approved higher-resolution original when available.
- **Real email delivery, DNS verification, Turnstile production keys, Search Console/Bing verification,
  host redirect rules, and the custom domain** require owner account access (see §3–6).

---

Built with Astro. Design recreated from the owner's originals; all copy is the owner's verified content.
