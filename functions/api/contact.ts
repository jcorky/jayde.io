/// <reference types="@cloudflare/workers-types" />
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contact  —  Cloudflare Pages Function
//
// Validates and rate-limits a contact submission, verifies a Cloudflare
// Turnstile token server-side, then hands the message to the companion mailer
// Worker (functions can't send email directly), which delivers it via Cloudflare
// Email Routing. No third-party email service. Success is only reported after
// the mailer accepts the message. Secrets are read from context.env and never
// exposed to the browser.
// ─────────────────────────────────────────────────────────────────────────────

interface Env {
  // Secrets / bindings (runtime — never in source or client)
  TURNSTILE_SECRET_KEY?: string; // Turnstile secret
  MAILER?: Fetcher; // service binding to the jayde-io-mailer Worker (preferred)
  MAILER_URL?: string; // OR the mailer Worker's URL (used when no service binding)
  MAILER_KEY?: string; // shared key the mailer Worker checks
  // Server configuration
  ALLOWED_HOSTNAMES?: string; // comma-separated
  // Optional: bind a KV namespace named RATE_LIMIT to enable durable rate limiting
  RATE_LIMIT?: KVNamespace;
}

const DEFAULT_HOSTNAMES = 'jayde.io,www.jayde.io,localhost,127.0.0.1';

const LIMITS = {
  maxBodyBytes: 16 * 1024,
  nameMax: 100,
  emailMax: 254,
  messageMin: 1,
  messageMax: 5000,
  rateMax: 5, // submissions
  rateWindowSec: 600, // per 10 minutes per IP
};

// ── helpers ──────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

function htmlResponse(status: number, heading: string, body: string): Response {
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${heading} · Jayde.IO</title><style>body{margin:0;background:#151111;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:grid;min-height:100vh;place-items:center;text-align:center;padding:2rem}a{color:#ffe66d}main{max-width:34rem}</style></head><body><main><h1>${heading}</h1><p>${body}</p><p><a href="/contact">Back to the contact page</a></p></main></body></html>`;
  return new Response(page, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && !/[\r\n]/.test(s);

const isTestSecret = (s: string) => /^[123]x0{20,}/.test(s);

function hostFrom(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// ── handler ──────────────────────────────────────────────────────────────────
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const accept = request.headers.get('accept') || '';
  const wantsHtml = accept.includes('text/html') && !accept.includes('application/json');
  const fail = (status: number, error: string) =>
    wantsHtml ? htmlResponse(status, 'Message not sent', escapeHtml(error)) : json({ ok: false, error }, status);

  // 1 · Configuration must be present — never fake success.
  const TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY;
  if (!TURNSTILE_SECRET_KEY || !env.MAILER_KEY || (!env.MAILER && !env.MAILER_URL)) {
    return fail(500, 'The contact form is not fully configured yet. Please email directly for now.');
  }
  const allowedHosts = new Set(
    (env.ALLOWED_HOSTNAMES || DEFAULT_HOSTNAMES).split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
  );

  // 2 · Enforce request shape. The Content-Length header is a cheap first gate,
  //     but it is attacker-controlled, so the real byte size is checked below.
  const contentType = request.headers.get('content-type') || '';
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > LIMITS.maxBodyBytes) return fail(413, 'Your message is too large.');

  // 3 · Origin check (when present) — reject cross-site posts.
  const originHost = hostFrom(request.headers.get('origin'));
  if (originHost && !allowedHosts.has(originHost)) {
    return fail(403, 'This request came from an unexpected origin.');
  }

  // 4 · Read the body once and enforce the REAL byte size before parsing.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return fail(400, 'Your message could not be read. Please try again.');
  }
  if (new TextEncoder().encode(rawBody).length > LIMITS.maxBodyBytes) {
    return fail(413, 'Your message is too large.');
  }

  // Parse body (JSON for the enhanced path; form-urlencoded for the no-JS form).
  let fields: Record<string, string> = {};
  try {
    if (contentType.includes('application/json')) {
      const raw = JSON.parse(rawBody) as Record<string, unknown>;
      for (const [k, v] of Object.entries(raw)) fields[k] = typeof v === 'string' ? v : '';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      for (const [k, v] of new URLSearchParams(rawBody).entries()) fields[k] = v;
    } else {
      return fail(415, 'Unsupported content type.');
    }
  } catch {
    return fail(400, 'Your message could not be read. Please try again.');
  }

  // 5 · Honeypot — silently accept-looking rejection for bots.
  if ((fields.company || '').trim() !== '') {
    return wantsHtml ? htmlResponse(200, 'Thanks', 'Your message has been received.') : json({ ok: true }, 200);
  }

  // 6 · Validate fields.
  const name = (fields.name || '').trim();
  const email = (fields.email || '').trim();
  const message = (fields.message || '').trim();
  const token = (fields['cf-turnstile-response'] || '').trim();

  if (name.length < 1 || name.length > LIMITS.nameMax) return fail(422, 'Please provide your name (1–100 characters).');
  if (email.length < 3 || email.length > LIMITS.emailMax || !isEmail(email))
    return fail(422, 'Please provide a valid email address.');
  if (message.length < LIMITS.messageMin || message.length > LIMITS.messageMax)
    return fail(422, 'Please provide a message (1–5000 characters).');
  if (!token) return fail(422, 'Please complete the verification challenge.');

  // 7 · Best-effort per-IP rate limit (when a KV namespace is bound). KV is
  //     eventually consistent and the read-then-write is not atomic, so this is a
  //     soft cap; use a Cloudflare Rate Limiting Rule for a hard limit.
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (env.RATE_LIMIT && ip) {
    try {
      const key = `rl:${ip}`;
      const current = Number((await env.RATE_LIMIT.get(key)) || '0');
      if (current >= LIMITS.rateMax) return fail(429, 'Too many messages in a short time. Please try again shortly.');
      await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: LIMITS.rateWindowSec });
    } catch {
      // If the limiter itself errors, do not block a genuine message.
    }
  }

  // 8 · Verify Turnstile token server-side.
  const verifyBody = new URLSearchParams();
  verifyBody.append('secret', TURNSTILE_SECRET_KEY);
  verifyBody.append('response', token);
  if (ip) verifyBody.append('remoteip', ip);
  verifyBody.append('idempotency_key', crypto.randomUUID());

  let outcome: { success: boolean; hostname?: string; action?: string; 'error-codes'?: string[] };
  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyBody,
    });
    outcome = await verifyRes.json();
  } catch {
    return fail(502, 'Verification is temporarily unavailable. Please try again.');
  }

  if (!outcome.success) return fail(403, 'Verification failed. Please try the challenge again.');

  // siteverify does not enforce hostname/action — we must. Relax for test keys.
  if (!isTestSecret(TURNSTILE_SECRET_KEY)) {
    if (outcome.hostname && !allowedHosts.has(outcome.hostname.toLowerCase()))
      return fail(403, 'Verification hostname did not match.');
    if (outcome.action && outcome.action !== 'contact') return fail(403, 'Verification action did not match.');
  }

  // 9 · Hand the validated message to the companion mailer Worker, which sends it
  //     via Cloudflare Email Routing. Recipient/sender are fixed inside that Worker.
  const submittedAt = new Date().toISOString();
  const mailerInit: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mailer-key': env.MAILER_KEY },
    body: JSON.stringify({ name, email, message, submittedAt }),
  };
  let mailRes: Response;
  try {
    // Prefer the service binding (data stays internal); fall back to the mailer
    // Worker's key-protected URL when no binding is configured.
    mailRes = env.MAILER
      ? await env.MAILER.fetch('https://jayde-io-mailer/notify', mailerInit)
      : await fetch(env.MAILER_URL as string, mailerInit);
  } catch {
    return fail(502, 'Your message could not be sent right now. Please try again or email directly.');
  }

  if (!mailRes.ok) {
    let detail = '';
    try {
      detail = await mailRes.text();
    } catch {
      /* ignore */
    }
    console.error(`Mailer failed: ${mailRes.status} ${detail}`);
    return fail(502, 'Your message could not be delivered right now. Please email directly instead.');
  }

  // Success only after the mailer accepted the message.
  return wantsHtml
    ? htmlResponse(200, 'Message sent', 'Thanks — your message has been sent. I’ll get back to you soon.')
    : json({ ok: true }, 200);
};
