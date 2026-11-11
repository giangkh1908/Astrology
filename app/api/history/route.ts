/** POST { kind, birthInfo, partnerBirthInfo? } → các mục đã luận của chính người đang đăng nhập trên lá số này. */
import { getChatStore } from '@/lib/store';
import { markAutoQuestions, parseHistoryRequest } from '@/lib/store/history-request';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const parsed = await parseHistoryRequest(request);
  if (!parsed.ok) return parsed.response;
  const store = getChatStore();
  const headers = { 'Cache-Control': 'no-store' };
  if (!store.enabled) return Response.json({ enabled: false, threads: [] }, { headers });
  try {
    return Response.json({ enabled: true, threads: markAutoQuestions(parsed.query.kind, await store.loadHistory(parsed.query)) }, { headers });
  } catch (error) {
    console.error('loadHistory failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'Không tải được lịch sử.' }, { status: 503, headers });
  }
}
