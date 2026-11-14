import { getUserStore } from '@/lib/users';
import { callerOf } from '@/lib/users/quota';
import { getChatStore } from '@/lib/store';
import { resolvePromptVersion } from '@/lib/store/chat-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Tài khoản đang đăng nhập, số câu đã dùng / giới hạn (limit null = không giới hạn)
 * và version prompt đang chạy (client bật thẻ hỏi lại + khung 3 tháng khi là v3).
 */
export async function GET(request: Request) {
  const caller = await callerOf(request);
  if (!caller) return json({ error: 'Chưa đăng nhập.' }, 401);
  const promptVersion = await resolvePromptVersion(getChatStore());
  if (caller.kind === 'env') return json({ username: caller.username, kind: 'env', used: 0, limit: null, promptVersion });
  try {
    const user = await getUserStore().getById(caller.userId);
    if (!user) return json({ error: 'Tài khoản không tồn tại.' }, 401);
    return json({ username: user.username, kind: 'member', used: user.chatUsed, limit: user.chatLimit, status: user.status, promptVersion });
  } catch (error) {
    console.error('account lookup failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Không đọc được tài khoản.' }, 503);
  }
}
