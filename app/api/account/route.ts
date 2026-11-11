import { getUserStore } from '@/lib/users';
import { callerOf } from '@/lib/users/quota';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

/** Tài khoản đang đăng nhập và số câu đã dùng / giới hạn (limit null = không giới hạn). */
export async function GET(request: Request) {
  const caller = await callerOf(request);
  if (!caller) return json({ error: 'Chưa đăng nhập.' }, 401);
  if (caller.kind === 'env') return json({ username: caller.username, kind: 'env', used: 0, limit: null });
  try {
    const user = await getUserStore().getById(caller.userId);
    if (!user) return json({ error: 'Tài khoản không tồn tại.' }, 401);
    return json({ username: user.username, kind: 'member', used: user.chatUsed, limit: user.chatLimit, status: user.status });
  } catch (error) {
    console.error('account lookup failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Không đọc được tài khoản.' }, 503);
  }
}
