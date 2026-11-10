import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createMemoryChatStore } from '../../lib/store/memory-chat-store';
import { disabledChatStore, setChatStoreForTest } from '../../lib/store';

// API admin: đổi version prompt. Bảo vệ hai lớp: proxy + route tự kiểm phiên; POST phải cùng nguồn (chống CSRF).
async function main() {
  process.env.AUTH_USERNAME = 'tester';
  process.env.AUTH_PASSWORD = 'fake-password-123';
  process.env.AUTH_SECRET = 'x'.repeat(40);
  const { createSessionToken, readAuthConfig, SESSION_COOKIE } = await import('../../lib/auth/session');
  const token = await createSessionToken(readAuthConfig()!);
  const { GET, POST } = await import('../../app/api/admin/prompt-version/route');
  const { proxy } = await import('../../proxy');

  const ORIGIN = 'http://localhost';
  const req = (method: 'GET' | 'POST', opts: { body?: unknown; cookie?: boolean; origin?: string | null } = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.cookie !== false) headers.cookie = `${SESSION_COOKIE}=${token}`;
    if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
    return new NextRequest(`${ORIGIN}/api/admin/prompt-version`, { method, headers, ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}) });
  };

  const store = createMemoryChatStore();
  setChatStoreForTest(store);

  // Proxy chặn khi chưa đăng nhập.
  assert.equal((await proxy(req('GET', { cookie: false }))).status, 401);

  // Route tự kiểm phiên (phòng khi proxy bị bỏ qua / sai matcher).
  assert.equal((await GET(req('GET', { cookie: false }))).status, 401);
  assert.equal((await POST(req('POST', { cookie: false, body: { version: 'v1' } }))).status, 401);

  // Đổi version hợp lệ.
  const ok = await POST(req('POST', { body: { version: 'v1' } }));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { active: 'v1' });
  const got = await (await GET(req('GET'))).json();
  assert.equal(got.active, 'v1');
  assert.deepEqual(got.versions.map((v: { id: string }) => v.id), ['v1', 'v2']);
  assert.equal(got.dbEnabled, true);

  // Giá trị lạ / body hỏng.
  assert.equal((await POST(req('POST', { body: { version: 'v9' } }))).status, 400);
  assert.equal((await POST(req('POST', { body: { version: '__proto__' } }))).status, 400);
  assert.equal((await POST(req('POST', { body: 'not-json-object' }))).status, 400);
  assert.equal((await GET(req('GET'))).headers.get('cache-control'), 'no-store');

  // CSRF: POST khác nguồn hoặc thiếu Origin bị chặn, version không đổi.
  assert.equal((await POST(req('POST', { body: { version: 'v2' }, origin: 'https://evil.example' }))).status, 403);
  assert.equal((await POST(req('POST', { body: { version: 'v2' }, origin: null }))).status, 403);
  assert.equal((await (await GET(req('GET'))).json()).active, 'v1');

  // Chưa cấu hình DB.
  setChatStoreForTest(disabledChatStore);
  assert.equal((await POST(req('POST', { body: { version: 'v2' } }))).status, 503);
  assert.equal((await (await GET(req('GET'))).json()).dbEnabled, false);

  setChatStoreForTest(null);
  console.log('admin-api: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
