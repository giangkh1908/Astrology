/** Đăng nhập trang chính (tài khoản env hoặc tài khoản tự đăng ký) và đăng ký tài khoản mới. */
import { NextResponse } from 'next/server';
import { getUserStore } from '@/lib/users';
import { MAX_PENDING, type UserStore } from '@/lib/users/user-store';
import { sameOrigin } from './guard';
import { dummyPasswordHash, hashPassword, normalizeUsername, registrationError, verifyPassword } from './password';
import { checkCredentials, createMemberToken, createSessionToken, readSessionSecret, SESSION_TTL_SECONDS, type AuthConfig } from './session';

const FAIL_DELAY_MS = 800;
const failDelay = () => new Promise(resolve => setTimeout(resolve, FAIL_DELAY_MS));
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

function withSessionCookie(cookieName: string, token: string): Response {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

async function readCredentials(request: Request): Promise<{ username: unknown; password: unknown } | null> {
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null) return null;
    const { username, password } = body as Record<string, unknown>;
    return { username, password };
  } catch {
    return null;
  }
}

const STATUS_MESSAGE = {
  pending: 'Tài khoản đang chờ admin duyệt.',
  rejected: 'Đăng ký của bạn đã bị từ chối.',
  locked: 'Tài khoản đã bị khóa. Liên hệ admin.',
} as const;

/**
 * Thử tài khoản env trước (không giới hạn lượt), rồi tới tài khoản tự đăng ký trong DB.
 * Chỉ báo trạng thái chờ duyệt/từ chối/khóa khi mật khẩu đúng, để không lộ tài khoản nào tồn tại.
 */
export async function handleUserLogin(request: Request, envConfig: AuthConfig | null, cookieName: string, store: UserStore = getUserStore()): Promise<Response> {
  const creds = await readCredentials(request);
  if (!creds) return err('Dữ liệu không hợp lệ.', 400);

  if (envConfig && checkCredentials(creds.username, creds.password, envConfig)) {
    return withSessionCookie(cookieName, await createSessionToken(envConfig));
  }

  const secret = readSessionSecret();
  if (!secret || !store.enabled) {
    if (!envConfig) return err('Máy chủ chưa cấu hình tài khoản đăng nhập.', 503);
    await failDelay();
    return err('Sai tên đăng nhập hoặc mật khẩu.', 401);
  }

  const username = normalizeUsername(creds.username);
  const password = typeof creds.password === 'string' ? creds.password : '';
  let user;
  try {
    user = username ? await store.findByUsername(username) : null;
  } catch (error) {
    console.error('findByUsername failed:', error instanceof Error ? error.message : 'unknown error');
    return err('Không kết nối được cơ sở dữ liệu, thử lại sau.', 503);
  }
  // Luôn băm một lần (kể cả khi không có tài khoản) để thời gian phản hồi không lộ tên tồn tại.
  const ok = await verifyPassword(password, user?.passwordHash ?? await dummyPasswordHash());
  if (!user || !ok) {
    await failDelay();
    return err('Sai tên đăng nhập hoặc mật khẩu.', 401);
  }
  if (user.status !== 'approved') return err(STATUS_MESSAGE[user.status], 403);
  try { await store.markLogin(user.id); } catch { /* không chặn đăng nhập */ }
  return withSessionCookie(cookieName, await createMemberToken(user.id, secret));
}

/** Tạo tài khoản chờ duyệt (không đăng nhập luôn). reservedNames: tên tài khoản env, không cho đăng ký trùng. */
export async function handleRegister(request: Request, reservedNames: string[], store: UserStore = getUserStore()): Promise<Response> {
  if (!sameOrigin(request)) return err('Yêu cầu không hợp lệ.', 403);
  if (!store.enabled || !readSessionSecret()) return err('Máy chủ chưa bật đăng ký.', 503);
  const creds = await readCredentials(request);
  if (!creds) return err('Dữ liệu không hợp lệ.', 400);
  const username = normalizeUsername(creds.username);
  const invalid = registrationError(username, creds.password);
  if (invalid) return err(invalid, 400);
  if (reservedNames.some(n => n.trim().toLowerCase() === username)) return err('Tên đăng nhập đã có người dùng.', 409);

  try {
    const counts = await store.countByStatus();
    if (counts.pending >= MAX_PENDING) return err('Đang có quá nhiều đăng ký chờ duyệt, vui lòng thử lại sau.', 503);
    const created = await store.createUser(username, await hashPassword(creds.password as string));
    if (created === 'taken') return err('Tên đăng nhập đã có người dùng.', 409);
  } catch (error) {
    console.error('register failed:', error instanceof Error ? error.message : 'unknown error');
    return err('Không đăng ký được, thử lại sau.', 500);
  }
  return NextResponse.json({ ok: true, message: 'Đăng ký thành công. Tài khoản sẽ dùng được sau khi admin duyệt.' }, { status: 201 });
}
