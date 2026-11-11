/** POST { kind, birthInfo, partnerBirthInfo?, threadKey } → đóng mục: lần sau không nạp lại (admin vẫn xem được). */
import { sameOrigin } from '@/lib/auth/guard';
import { getChatStore } from '@/lib/store';
import { parseHistoryRequest, validThreadKey } from '@/lib/store/history-request';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!sameOrigin(request)) return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403, headers });
  const parsed = await parseHistoryRequest(request);
  if (!parsed.ok) return parsed.response;
  if (!validThreadKey(parsed.body.threadKey)) return Response.json({ error: 'Thiếu mục cần đóng.' }, { status: 400, headers });
  const store = getChatStore();
  if (!store.enabled) return new Response(null, { status: 204, headers });
  try {
    await store.closeThread({ ...parsed.query, threadKey: parsed.body.threadKey });
    return new Response(null, { status: 204, headers });
  } catch (error) {
    console.error('closeThread failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'Không đóng được mục.' }, { status: 503, headers });
  }
}
