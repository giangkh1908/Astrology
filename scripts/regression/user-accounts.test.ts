/** Tài khoản tự đăng ký: băm mật khẩu, phiên member, đăng ký/đăng nhập, trừ/hoàn lượt chat, proxy. Dữ liệu giả. */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

async function main() {
  process.env.AUTH_USERNAME = 'tester';
  process.env.AUTH_PASSWORD = 'fake-password-123';
  process.env.ADMIN_USERNAME = 'boss';
  process.env.ADMIN_PASSWORD = 'fake-admin-password-456';
  process.env.AUTH_SECRET = 'x'.repeat(40);

  const { hashPassword, verifyPassword, registrationError, normalizeUsername } = await import('../../lib/auth/password');
  const session = await import('../../lib/auth/session');
  const { createMemoryUserStore } = await import('../../lib/users/memory-user-store');
  const { setUserStoreForTest } = await import('../../lib/users');
  const { chargeChat, refundingOnFinish, quotaHeader } = await import('../../lib/users/quota');
  const { handleUserLogin, handleRegister } = await import('../../lib/auth/user-handlers');
  const { proxy } = await import('../../proxy');
  const { GET: account } = await import('../../app/api/account/route');

  // ── Mật khẩu ──
  const h = await hashPassword('mat-khau-gia-1', 1000);
  assert.ok(h.startsWith('pbkdf2$1000$'));
  assert.equal(await verifyPassword('mat-khau-gia-1', h), true);
  assert.equal(await verifyPassword('mat-khau-gia-2', h), false);
  assert.notEqual(await hashPassword('mat-khau-gia-1', 1000), h, 'salt ngẫu nhiên');
  for (const bad of ['', 'plain', 'pbkdf2$abc$x$y', 'pbkdf2$0$x$y', 'md5$1$a$b']) assert.equal(await verifyPassword('x', bad), false, bad);
  assert.equal(normalizeUsername('  An.Nguyen '), 'an.nguyen');
  assert.equal(registrationError('ab', 'mat-khau-dai'), registrationError('ab', 'mat-khau-dai'));
  assert.ok(registrationError('ab', 'mat-khau-dai'));
  assert.ok(registrationError('tên-có-dấu', 'mat-khau-dai'));
  assert.ok(registrationError('hople', 'ngan'));
  assert.ok(registrationError('hople', 'x'.repeat(129)));
  assert.equal(registrationError('hop.le_1-2', 'mat-khau-dai'), null);

  // ── Phiên member ──
  const secret = process.env.AUTH_SECRET!;
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const mt = await session.createMemberToken(id, secret);
  assert.equal(await session.verifyMemberToken(mt, secret), id);
  assert.equal(await session.verifyMemberToken(mt, 'y'.repeat(40)), null, 'sai khóa');
  assert.equal(await session.verifyMemberToken(mt, secret, Date.now() + (session.SESSION_TTL_SECONDS + 5) * 1000), null, 'hết hạn');
  const [, exp, mac] = mt.split('.');
  const forged = `${Buffer.from(`member:${'1'.repeat(8)}-1111-1111-1111-${'1'.repeat(12)}`).toString('base64url')}.${exp}.${mac}`;
  assert.equal(await session.verifyMemberToken(forged, secret), null, 'đổi id thì sai chữ ký');
  // Token env/admin không được coi là member và ngược lại.
  const envToken = await session.createSessionToken(session.readAuthConfig()!);
  const adminToken = await session.createSessionToken(session.readAdminConfig()!);
  assert.equal(await session.verifyMemberToken(envToken, secret), null);
  assert.equal(await session.verifyMemberToken(adminToken, secret), null);
  assert.equal(await session.verifySessionToken(mt, session.readAdminConfig()), false);
  assert.equal(await session.verifyUserSession(mt), true);
  assert.equal(await session.verifyUserSession(envToken), true);
  assert.equal(await session.verifyUserSession(adminToken), false);

  // ── Đăng ký / đăng nhập ──
  const store = createMemoryUserStore();
  setUserStoreForTest(store);
  const ORIGIN = 'http://localhost';
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) });
  const register = (body: unknown, headers?: Record<string, string>) => handleRegister(post('/api/auth/register', body, headers), ['tester', 'boss', 'admin']);
  const login = (body: unknown) => handleUserLogin(post('/api/auth/login', body), session.readAuthConfig(), session.SESSION_COOKIE);
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0];

  assert.equal((await register({ username: 'khach', password: 'mat-khau-gia-1' }, { origin: 'http://evil.example' })).status, 403, 'khác nguồn');
  assert.equal((await register({ username: 'x', password: 'mat-khau-gia-1' })).status, 400);
  assert.equal((await register({ username: 'Tester', password: 'mat-khau-gia-1' })).status, 409, 'trùng tên tài khoản env');
  const reg = await register({ username: ' Khach ', password: 'mat-khau-gia-1' });
  assert.equal(reg.status, 201);
  assert.equal((await register({ username: 'khach', password: 'mat-khau-khac-1' })).status, 409, 'trùng tên');
  const rec = await store.findByUsername('khach');
  assert.ok(rec && rec.status === 'pending' && rec.chatLimit === 5 && rec.chatUsed === 0);
  assert.ok(!rec.passwordHash.includes('mat-khau-gia-1'), 'không lưu mật khẩu thô');

  // Sai mật khẩu → 401 (không lộ trạng thái); đúng mật khẩu nhưng chờ duyệt → 403.
  assert.equal((await login({ username: 'khach', password: 'sai-mat-khau' })).status, 401);
  assert.equal((await login({ username: 'khong-ton-tai', password: 'mat-khau-gia-1' })).status, 401);
  const pendingLogin = await login({ username: 'khach', password: 'mat-khau-gia-1' });
  assert.equal(pendingLogin.status, 403);
  assert.match((await pendingLogin.json()).error, /chờ admin duyệt/);
  assert.equal(cookieOf(pendingLogin), '');

  // Tài khoản env vẫn đăng nhập được.
  const envLogin = await login({ username: 'tester', password: 'fake-password-123' });
  assert.equal(envLogin.status, 200);
  const envCookie = cookieOf(envLogin);

  await store.updateUser(rec.id, { action: 'approve' });
  const ok = await login({ username: 'KHACH', password: 'mat-khau-gia-1' });
  assert.equal(ok.status, 200);
  const memberCookie = cookieOf(ok);
  assert.match(memberCookie, new RegExp(`^${session.SESSION_COOKIE}=`));
  assert.ok((await store.getById(rec.id))?.lastLoginAt);

  // ── Proxy: /register mở; phiên member vào được trang chính, không vào được admin ──
  const page = (path: string, cookie?: string) => new NextRequest(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} });
  assert.equal((await proxy(page('/register'))).headers.get('x-middleware-next'), '1');
  assert.equal((await proxy(page('/chart'))).status, 307);
  assert.equal((await proxy(page('/chart', memberCookie))).headers.get('x-middleware-next'), '1');
  assert.equal((await proxy(page('/api/admin/prompt-version', memberCookie))).status, 401);

  // ── /api/account ──
  const acc = await account(page('/api/account', memberCookie));
  assert.deepEqual(await acc.json(), { username: 'khach', kind: 'member', used: 0, limit: 5, status: 'approved' });
  assert.equal((await account(page('/api/account'))).status, 401);
  assert.equal((await (await account(page('/api/account', envCookie))).json()).limit, null);

  // ── Trừ lượt ──
  const chatReq = (cookie?: string) => new Request(`${ORIGIN}/api/interpret`, { method: 'POST', headers: cookie ? { cookie } : {} });
  assert.equal(((await chargeChat(chatReq())) as { ok: false; response: Response }).response.status, 401);
  const envCharge = await chargeChat(chatReq(envCookie));
  assert.ok(envCharge.ok && envCharge.quota.limit === null, 'tài khoản env không giới hạn');

  // 8 request đồng thời với hạn mức 5 → đúng 5 được, 3 bị từ chối.
  const results = await Promise.all(Array.from({ length: 8 }, () => chargeChat(chatReq(memberCookie))));
  assert.equal(results.filter(r => r.ok).length, 5);
  const denied = results.find(r => !r.ok) as { ok: false; response: Response };
  assert.equal(denied.response.status, 403);
  assert.equal(denied.response.headers.get('X-Chat-Quota'), '5/5');
  assert.match((await denied.response.json()).error, /hết 5 câu/);
  assert.equal((await store.getById(rec.id))?.chatUsed, 5);

  // Lỗi trước khi có chữ → hoàn lượt (một lần); có chữ rồi hoặc thành công → không hoàn.
  const charged = results.find(r => r.ok) as Extract<Awaited<ReturnType<typeof chargeChat>>, { ok: true }>;
  const base = { toolCalls: [], durationMs: 1 };
  let finished = 0;
  const fin = refundingOnFinish(() => { finished++; }, charged.refund);
  fin({ ...base, text: '', status: 'error' });
  fin({ ...base, text: '', status: 'aborted' });
  await new Promise(r => setTimeout(r, 10));
  assert.equal(finished, 2);
  assert.equal((await store.getById(rec.id))?.chatUsed, 4, 'hoàn đúng 1 lần');
  const second = await chargeChat(chatReq(memberCookie));
  assert.ok(second.ok);
  refundingOnFinish(() => undefined, second.refund)({ ...base, text: 'Đã trả lời một phần', status: 'aborted' });
  refundingOnFinish(() => undefined, second.refund)({ ...base, text: 'Trả lời', status: 'ok' });
  await new Promise(r => setTimeout(r, 10));
  assert.equal((await store.getById(rec.id))?.chatUsed, 5);

  // Admin mở thêm → hỏi tiếp được; khóa → bị chặn ngay dù phiên còn hạn; không giới hạn.
  await store.updateUser(rec.id, { action: 'add', amount: 5 });
  const after = await chargeChat(chatReq(memberCookie));
  assert.ok(after.ok && after.quota.used === 6 && after.quota.limit === 10);
  assert.equal(quotaHeader(after.quota), '6/10');
  await store.updateUser(rec.id, { action: 'lock' });
  const locked = await chargeChat(chatReq(memberCookie));
  assert.ok(!locked.ok && locked.response.status === 403);
  assert.equal((await login({ username: 'khach', password: 'mat-khau-gia-1' })).status, 403);
  await store.updateUser(rec.id, { action: 'unlock' });
  await store.updateUser(rec.id, { action: 'setLimit', limit: null });
  const unlimited = await chargeChat(chatReq(memberCookie));
  assert.ok(unlimited.ok && unlimited.quota.limit === null);
  assert.equal(quotaHeader(unlimited.quota), '7/unlimited');

  // Tài khoản bị xóa khỏi DB → phiên không dùng được để chat.
  const ghost = `${session.SESSION_COOKIE}=${await session.createMemberToken('11111111-1111-4111-8111-111111111111', secret)}`;
  assert.equal(((await chargeChat(chatReq(ghost))) as { ok: false; response: Response }).response.status, 401);

  // DB lỗi khi trừ lượt → từ chối (không cho chat miễn phí).
  const broken = { ...store, consumeChat: async () => { throw new Error('db down'); } };
  assert.equal(((await chargeChat(chatReq(memberCookie), broken)) as { ok: false; response: Response }).response.status, 503);

  setUserStoreForTest(null);
  console.log('user-accounts: ok');
}

main().catch(error => { console.error(error); process.exit(1); });
