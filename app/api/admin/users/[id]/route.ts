import { requireAdmin } from '@/lib/auth/guard';
import { getUserStore } from '@/lib/users';
import { parseUserUpdate } from '@/lib/users/user-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request, { write: true });
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Dữ liệu không hợp lệ.' }, 400); }
  const update = parseUserUpdate(body);
  if (!update) return json({ error: 'Thao tác không hợp lệ.' }, 400);

  const store = getUserStore();
  if (!store.enabled) return json({ error: 'Chưa cấu hình DATABASE_URL.' }, 503);
  const { id } = await params;
  try {
    const user = await store.updateUser(id, update);
    if (!user) return json({ error: 'Không tìm thấy người dùng.' }, 404);
    return json({ user });
  } catch (error) {
    console.error('updateUser failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Không lưu được, thử lại sau.' }, 500);
  }
}
