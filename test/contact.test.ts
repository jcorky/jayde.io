// Unit test for the contact Pages Function's success path + email composition.
// Mocks fetch for Turnstile siteverify and Resend so no real account is needed.
// Run: node --experimental-strip-types --test test/contact.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contact.ts';

const ENV = {
  RESEND_API_KEY: 're_fake_key',
  TURNSTILE_SECRET_KEY: '0x_realish_secret_key_not_a_test_key', // non-test => hostname/action enforced
  CONTACT_TO: 'Jayde.cork@gmail.com',
  CONTACT_FROM: 'Jayde.IO <website@jayde.io>',
  ALLOWED_HOSTNAMES: 'jayde.io,www.jayde.io',
};

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://jayde.io/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://jayde.io', ...headers },
    body: JSON.stringify(body),
  });
}

// Install a fetch mock that captures the Resend request.
function installFetch(opts: { siteverify?: object; resendStatus?: number; resendBody?: object }) {
  const captured: { resend?: any } = {};
  (globalThis as any).fetch = async (url: string, init: any) => {
    if (String(url).includes('siteverify')) {
      return new Response(JSON.stringify(opts.siteverify ?? { success: true, hostname: 'jayde.io', action: 'contact' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (String(url).includes('api.resend.com')) {
      captured.resend = { headers: init.headers, body: JSON.parse(init.body) };
      return new Response(JSON.stringify(opts.resendBody ?? { id: 'email_123' }), {
        status: opts.resendStatus ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error('unexpected fetch to ' + url);
  };
  return captured;
}

test('success path composes and sends the email correctly', async () => {
  const captured = installFetch({});
  const req = makeRequest({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Hello Jayde — testing.',
    'cf-turnstile-response': 'valid-token',
  });
  const res = await onRequestPost({ request: req, env: ENV } as any);
  const json = await res.json();

  assert.equal(res.status, 200, 'HTTP 200');
  assert.deepEqual(json, { ok: true }, 'returns ok:true only after provider accepts');
  assert.equal(res.headers.get('cache-control'), 'no-store', 'no-store header set by the function');

  const b = captured.resend.body;
  assert.deepEqual(b.to, ['Jayde.cork@gmail.com'], 'recipient is server-fixed');
  assert.equal(b.from, 'Jayde.IO <website@jayde.io>', 'sender is server-fixed');
  assert.equal(b.reply_to, 'ada@example.com', 'reply_to is the visitor (snake_case)');
  assert.equal(b.subject, 'Jayde.IO contact: Ada Lovelace', 'subject format');
  assert.match(b.text, /Hello Jayde/, 'message in plain text');
  assert.match(b.html, /Hello Jayde/, 'message in html');
  assert.ok(captured.resend.headers['Idempotency-Key'], 'idempotency key sent');
  assert.equal(captured.resend.headers.Authorization, 'Bearer re_fake_key', 'bearer auth');
});

test('provider failure returns 502, not fake success', async () => {
  installFetch({ resendStatus: 401, resendBody: { statusCode: 401, name: 'validation_error', message: 'bad key' } });
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co', message: 'hi', 'cf-turnstile-response': 't' }),
    env: ENV,
  } as any);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).ok, false);
});

test('turnstile failure returns 403', async () => {
  installFetch({ siteverify: { success: false, 'error-codes': ['invalid-input-response'] } });
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co', message: 'hi', 'cf-turnstile-response': 'bad' }),
    env: ENV,
  } as any);
  assert.equal(res.status, 403);
});

test('hostname mismatch is rejected (non-test secret)', async () => {
  installFetch({ siteverify: { success: true, hostname: 'evil.example', action: 'contact' } });
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co', message: 'hi', 'cf-turnstile-response': 't' }),
    env: ENV,
  } as any);
  assert.equal(res.status, 403);
});

test('missing configuration returns 500, not fake success', async () => {
  installFetch({});
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co', message: 'hi', 'cf-turnstile-response': 't' }),
    env: { ...ENV, RESEND_API_KEY: undefined },
  } as any);
  assert.equal(res.status, 500);
});

test('CRLF in email is rejected', async () => {
  installFetch({});
  const res = await onRequestPost({
    request: makeRequest({ name: 'A', email: 'a@b.co\r\nBcc: x@y.z', message: 'hi', 'cf-turnstile-response': 't' }),
    env: ENV,
  } as any);
  assert.equal(res.status, 422);
});
