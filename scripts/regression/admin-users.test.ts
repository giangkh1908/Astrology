import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createMemoryUserStore } from '../../lib/users/memory-user-store';
import { setUserStoreForTest } from '../../lib/users';
import { MAX_CHAT_LIMIT, parseUserUpdate } from '../../lib/users/user-store';

// API admin: duyệt / cấp thêm / khóa tài khoản tự đăng ký. Chỉ admin, POST cùng nguồn.
async function main() {
  // parseUserUpdate: các ca biên.
  assert.deepEqual(parseUserUpdate({ action: 'approve' }), { action: 'approve' });
  assert.deepEqual(parseUserUpdate({ action: 'add', amount: 5 }), { action: 'add', amount: 5 });
  assert.deepEqual(parseUserUpdate({ action: 'setLimit', limit: null }), { action: 'setLimit', limit: null });
  assert.deepEqual(parseUserUpdate({ action: 'setLimit', limit: 0 }), { action: 'setLimit', limit: 0 });
  for (const bad of [
    null, 'x', 42, {}, { action: 'nope' }, { action: 'add' }, { action: 'add', amount: 0 }, { action: 'add', amount: -3 },
    { action: 'add', amount: 1.5 }, { action: 'add', amount: '5' }, { action: 'add', amount: MAX_CHAT_LIMIT + 1 },
    { action: 'setLimit' }, { action: 'setLimit', limit: -1 }, { action: 'setLimit', limit: 2.5 },
    { action: 'setLimit', limit: MAX_CHAT_LIMIT + 1 }, { action: 'setLimit', limit: '5' },
  ]) assert.equal(parseUserUpdate(bad), null, JSON.stringify(bad));

  process.env.AUTH_USERNAME = 'tester';
  process.env.AUTH_PASSWORD = 'fake-password-123';
  process.env.ADMIN_USERNAME = 'boss';
  process.env.ADMIN_PASSWORD = 'fake-admin-password-456';
  process.env.AUTH_SECRET = 'x'.repeat(40);
  const { ADMIN_COOKIE, createSessionToken, readAdminConfig, readAuthConfig, SESSION_COOKIE } = await import('../../lib/auth/session');
  const adminToken = await createSessionToken(readAdminConfig()!);
  const userToken = await createSessionToken(readAuthConfig()!);
  const { POST } = await import('../../app/api/admin/users/[id]/route');

  const ORIGIN = 'http://localhost';
  const call = (id: string, opts: { body?: unknown; cookie?: boolean; userCookie?: boolean; origin?: string | null } = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.cookie !== false) headers.cookie = opts.userCookie ? `${SESSION_COOKIE}=${userToken}` : `${ADMIN_COOKIE}=${adminToken}`;
    if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
    const req = new NextRequest(`${ORIGIN}/api/admin/users/${id}`, {
      method: 'POST', headers, ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
    return POST(req, { params: Promise.resolve({ id }) });
  };

  const store = createMemoryUserStore();
  setUserStoreForTest(store);
  const created = await store.createUser('alice', 'fake-hash');
  assert.notEqual(created, 'taken');
  const id = (created as { id: string }).id;

  // Xác thực.
  assert.equal((await call(id, { cookie: false, body: { action: 'approve' } })).status, 401);
  assert.equal((await call(id, { userCookie: true, body: { action: 'approve' } })).status, 401);
  // CSRF.
  assert.equal((await call(id, { body: { action: 'approve' }, origin: 'https://evil.example' })).status, 403);
  assert.equal((await call(id, { body: { action: 'approve' }, origin: null })).status, 403);
  assert.equal((await store.getById(id))!.status, 'pending');

  // Body sai / id lạ.
  assert.equal((await call(id, { body: { action: 'add', amount: -1 } })).status, 400);
  assert.equal((await call(id, { body: 'str' })).status, 400);
  assert.equal((await call('no-such-id', { body: { action: 'approve' } })).status, 404);

  // Duyệt.
  const ok = await call(id, { body: { action: 'approve' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal((await ok.json()).user.status, 'approved');

  // Dùng hết 5 câu rồi cộng 5 → giới hạn 10.
  for (let i = 0; i < 5; i++) assert.equal((await store.consumeChat(id)).ok, true);
  assert.equal((await store.consumeChat(id)).ok, false);
  const added = await (await call(id, { body: { action: 'add', amount: 5 } })).json();
  assert.equal(added.user.chatLimit, 10);
  assert.equal((await store.consumeChat(id)).ok, true);

  // Không giới hạn.
  const unl = await (await call(id, { body: { action: 'setLimit', limit: null } })).json();
  assert.equal(unl.user.chatLimit, null);
  assert.equal((await store.consumeChat(id)).ok, true);

  // Khóa.
  const locked = await (await call(id, { body: { action: 'lock' } })).json();
  assert.equal(locked.user.status, 'locked');
  const res = await store.consumeChat(id);
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.reason, 'inactive');

  setUserStoreForTest(null);
  console.log('admin-users: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
