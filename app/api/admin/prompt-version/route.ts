import { requireAdmin } from '@/lib/auth/guard';
import { isPromptVersionId, PROMPT_VERSIONS } from '@/lib/prompts';
import { getChatStore } from '@/lib/store';
import { ACTIVE_PROMPT_KEY, resolvePromptVersion } from '@/lib/store/chat-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const store = getChatStore();
  let usage: Awaited<ReturnType<typeof store.versionUsage>> = [];
  try { usage = await store.versionUsage(); } catch (error) {
    console.error('versionUsage failed:', error instanceof Error ? error.message : 'unknown error');
  }
  return json({ active: await resolvePromptVersion(store), versions: PROMPT_VERSIONS, usage, dbEnabled: store.enabled });
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request, { write: true });
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Dữ liệu không hợp lệ.' }, 400); }
  const version = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).version : undefined;
  if (!isPromptVersionId(version)) return json({ error: 'Version không tồn tại.' }, 400);

  const store = getChatStore();
  if (!store.enabled) return json({ error: 'Chưa cấu hình DATABASE_URL.' }, 503);
  try {
    await store.setSetting(ACTIVE_PROMPT_KEY, version);
  } catch (error) {
    console.error('setSetting failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Không lưu được, thử lại sau.' }, 500);
  }
  return json({ active: version });
}
