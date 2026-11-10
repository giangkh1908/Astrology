import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

// Đăng nhập một tài khoản từ env: sai mật khẩu bị từ chối, cookie giả/hết hạn bị chặn,
// proxy trả 401 cho API và chuyển /login cho trang khi chưa đăng nhập.
async function main() {
  process.env.AUTH_USERNAME = 'tester';
  process.env.AUTH_PASSWORD = 'fake-password-123';
  process.env.AUTH_SECRET = 'x'.repeat(40);

  const s = await import('../../lib/auth/session');
  const config = s.readAuthConfig()!;
  assert.ok(config);

  // Thiếu hoặc secret ngắn → fail closed.
  assert.equal(s.readAuthConfig({ AUTH_USERNAME: 'a', AUTH_PASSWORD: 'b', AUTH_SECRET: 'short' }), null);
  assert.equal(s.readAuthConfig({}), null);

  assert.equal(s.checkCredentials('tester', 'fake-password-123', config), true);
  assert.equal(s.checkCredentials(' tester ', 'fake-password-123', config), true);
  assert.equal(s.checkCredentials('tester', 'wrong', config), false);
  assert.equal(s.checkCredentials('other', 'fake-password-123', config), false);
  assert.equal(s.checkCredentials(undefined, undefined, config), false);

  const now = Date.UTC(2026, 0, 1);
  const token = await s.createSessionToken(config, now);
  assert.equal(await s.verifySessionToken(token, config, now), true);
  assert.equal(await s.verifySessionToken(token, config, now + (s.SESSION_TTL_SECONDS + 1) * 1000), false, 'hết hạn');
  assert.equal(await s.verifySessionToken(token, { ...config, secret: 'y'.repeat(40) }, now), false, 'đổi secret');
  assert.equal(await s.verifySessionToken(token, { ...config, username: 'other' }, now), false, 'đổi username');
  const [u, exp, mac] = token.split('.');
  assert.equal(await s.verifySessionToken(`${u}.${Number(exp) + 99999}.${mac}`, config, now), false, 'sửa hạn');
  assert.equal(await s.verifySessionToken('garbage', config, now), false);
  assert.equal(await s.verifySessionToken(undefined, config, now), false);
  assert.equal(await s.verifySessionToken(token, null, now), false);

  assert.equal(s.safeNextPath('/chart?x=1'), '/chart?x=1');
  assert.equal(s.safeNextPath('//evil.com'), '/');
  assert.equal(s.safeNextPath('/\\evil.com'), '/');
  assert.equal(s.safeNextPath('https://evil.com'), '/');
  assert.equal(s.safeNextPath('/login'), '/');
  assert.equal(s.safeNextPath(null), '/');
  // Trình duyệt bỏ tab/xuống dòng khi parse URL: '/<tab>/evil.com' → '//evil.com'.
  assert.equal(s.safeNextPath('/\t/evil.com'), '/');
  assert.equal(s.safeNextPath('/\n/evil.com'), '/');
  assert.equal(s.safeNextPath('/\r\n/evil.com'), '/');
  assert.equal(s.safeNextPath('/a\\b'), '/');
  assert.equal(s.safeNextPath('/a\b'), '/');
  assert.equal(s.safeNextPath('/admin/logs?status=ok#x'), '/admin/logs?status=ok#x');

  // Username có dấu chấm (email) vẫn đăng nhập được.
  const dotted = { ...config, username: 'me@example.com' };
  assert.equal(await s.verifySessionToken(await s.createSessionToken(dotted, now), dotted, now), true, 'username có dấu chấm');

  // Route đăng nhập.
  const { POST: login } = await import('../../app/api/auth/login/route');
  const call = (body: unknown) => login(new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  const bad = await call({ username: 'tester', password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get('set-cookie'), null);
  const good = await call({ username: 'tester', password: 'fake-password-123' });
  assert.equal(good.status, 200);
  const setCookie = good.headers.get('set-cookie') ?? '';
  assert.match(setCookie, new RegExp(`^${s.SESSION_COOKIE}=`));
  assert.match(setCookie, /HttpOnly/i);
  const cookieValue = setCookie.split(';')[0].split('=').slice(1).join('=');

  // Proxy.
  const { proxy } = await import('../../proxy');
  const req = (path: string, cookie?: string) => new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie: `${s.SESSION_COOKIE}=${cookie}` } : {},
  });
  const apiNoAuth = await proxy(req('/api/interpret'));
  assert.equal(apiNoAuth.status, 401);
  const pageNoAuth = await proxy(req('/chart?a=1'));
  assert.equal(pageNoAuth.status, 307);
  const loc = new URL(pageNoAuth.headers.get('location')!);
  assert.equal(loc.pathname, '/login');
  assert.equal(loc.searchParams.get('next'), '/chart?a=1');
  assert.equal((await proxy(req('/api/interpret', 'forged.123.abc'))).status, 401);
  assert.equal((await proxy(req('/login'))).headers.get('x-middleware-next'), '1');
  assert.equal((await proxy(req('/api/auth/login'))).headers.get('x-middleware-next'), '1');
  assert.equal((await proxy(req('/api/interpret', decodeURIComponent(cookieValue)))).headers.get('x-middleware-next'), '1');
  assert.equal((await proxy(req('/chart', decodeURIComponent(cookieValue)))).headers.get('x-middleware-next'), '1');

  // Đăng xuất chỉ nhận yêu cầu cùng nguồn (chống CSRF ép đăng xuất).
  const { POST: logout } = await import('../../app/api/auth/logout/route');
  const out = (origin?: string) => logout(new Request('http://localhost/api/auth/logout', { method: 'POST', headers: origin ? { origin } : {} }));
  assert.equal((await out('https://evil.example')).status, 403);
  assert.equal((await out()).status, 403);
  const okOut = await out('http://localhost');
  assert.equal(okOut.status, 200);
  assert.match(okOut.headers.get('set-cookie') ?? '', /Max-Age=0/i);

  // Thiếu cấu hình → chặn tất cả, login trả 503.
  delete process.env.AUTH_SECRET;
  assert.equal((await proxy(req('/api/interpret', decodeURIComponent(cookieValue)))).status, 401);
  assert.equal((await call({ username: 'tester', password: 'fake-password-123' })).status, 503);

  console.log('auth-session: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
