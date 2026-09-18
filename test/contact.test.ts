// Unit test for the contact Pages Function's success path + validation.
// Mocks Turnstile siteverify (global fetch) and the mailer service binding
// (env.MAILER.fetch) so no real Cloudflare/Email Routing setup is needed.
// Run: node --experimental-strip-types --test test/contact.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contact.ts';

function makeMailer(status = 200, bodyObj: object = { ok: true }) {
  const captured: { headers?: any; body?: any; url?: string } = {};
  const mailer = {
    fetch: async (url: string, init: any) => {
      captured.url = String(url);
      captured.headers = init.headers;
      captured.body = JSON.parse(init.body);
      return new Response(JSON.stringify(bodyObj), { status, headers: { 'Content-Type': 'application/json' } });
    },
  };
  return { mailer, captured };
}

function baseEnv(mailer: any) {
  return {
    TURNSTILE_SECRET_KEY: '0x_realish_secret_key_not_a_test_key', // non-test => hostname/action enforced
    MAILER: mailer,
    MAILER_KEY: 'shared-secret-123',
    ALLOWED_HOSTNAMES: 'jayde.io,www.jayde.io',
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://jayde.io/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://jayde.io', ...headers },
    body: JSON.stringify(body),
  });
}

// Turnstile siteverify mock via global fetch.
function installSiteverify(outcome: object = { success: true, hostname: 'jayde.io', action: 'contact' }) {
  (globalThis as any).fetch = async (url: string) => {
    if (String(url).includes('siteverify'))
      return new Response(JSON.stringify(outcome), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error('unexpected fetch to ' + url);
  };
}

test('success path hands the message to the mailer worker', async () => {
  installSiteverify();
  const { mailer, captured } = makeMailer();
  const req = makeRequest({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Hello Jayde — testing.',
    'cf-turnstile-response': 'valid-token',
  });
  const res = await onRequestPost({ request: req, env: baseEnv(mailer) } as any);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body, { ok: true }, 'returns ok:true only after the mailer accepts');
  assert.equal(res.headers.get('cache-control'), 'no-store');

  assert.equal(captured.headers['x-mailer-key'], 'shared-secret-123', 'shared key sent to the mailer');
  assert.equal(captured.body.name, 'Ada Lovelace');
  assert.equal(captured.body.email, 'ada@example.com', 'visitor email forwarded (used as Reply-To)');
  assert.match(captured.body.message, /Hello Jayde/);
  assert.ok(captured.body.submittedAt, 'submission time forwarded');
});

test('mailer failure returns 502, not fake success', async () => {
  installSiteverify();
  const { mailer } = makeMailer(502, { ok: false, error: 'send-failed' });
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co', message: 'hi', 'cf-turnstile-response': 't' }),
    env: baseEnv(mailer),
  } as any);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).ok, false);
});

test('turnstile failure returns 403', async () => {
  installSiteverify({ success: false, 'error-codes': ['invalid-input-response'] });
  const { mailer } = makeMailer();
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co', message: 'hi', 'cf-turnstile-response': 'bad' }),
    env: baseEnv(mailer),
  } as any);
  assert.equal(res.status, 403);
});

test('hostname mismatch is rejected (non-test secret)', async () => {
  installSiteverify({ success: true, hostname: 'evil.example', action: 'contact' });
  const { mailer } = makeMailer();
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co', message: 'hi', 'cf-turnstile-response': 't' }),
    env: baseEnv(mailer),
  } as any);
  assert.equal(res.status, 403);
});

test('missing mailer binding returns 500, not fake success', async () => {
  installSiteverify();
  const env = baseEnv(makeMailer().mailer) as any;
  env.MAILER = undefined;
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co', message: 'hi', 'cf-turnstile-response': 't' }),
    env,
  } as any);
  assert.equal(res.status, 500);
});

test('CRLF in email is rejected', async () => {
  installSiteverify();
  const { mailer } = makeMailer();
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co\r\nBcc: x@y.z', message: 'hi', 'cf-turnstile-response': 't' }),
    env: baseEnv(mailer),
  } as any);
  assert.equal(res.status, 422);
});
