/** Lịch sử hội thoại theo tài khoản: nạp lại mục đã luận, luận lại/đóng mục, tách người dùng, hợp bàn. Dữ liệu giả. */
import assert from 'node:assert/strict';
import { buildHistory, type HistoryRow } from '../../lib/store/chat-store';
import { createMemoryChatStore } from '../../lib/store/memory-chat-store';
import { setChatStoreForTest } from '../../lib/store';
import { envUserCookie } from './helpers/session';

process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_MODEL = 'fake/model';
let reply = 'Trả lời giả';
globalThis.fetch = (async () => {
  const enc = new TextEncoder();
  const text = reply;
  return new Response(new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  }), { status: 200 });
}) as typeof fetch;

let finished = false;
process.on('beforeExit', () => { if (!finished) { console.error('chat-history: treo'); process.exit(1); } });
const flush = () => new Promise(r => setTimeout(r, 30));
async function drain(res: Response) {
  assert.equal(res.status, 200, `status ${res.status}`);
  const reader = res.body!.getReader();
  for (;;) { const { done } = await reader.read(); if (done) break; }
  await flush();
}

function pairing() {
  const row = (over: Partial<HistoryRow>): HistoryRow => ({ threadKey: 't', updatedAt: '2026-01-01', role: 'user', content: 'x', hidden: false, requestId: null, ...over });
  const threads = buildHistory([
    row({ content: 'Q1', requestId: 'a' }),
    row({ content: 'Q2', requestId: 'b' }), // trả lời của Q1 về sau Q2 (hai lượt chồng nhau) vẫn ghép đúng
    row({ role: 'assistant', content: 'A2', requestId: 'b' }),
    row({ role: 'assistant', content: 'A1', requestId: 'a' }),
    row({ content: 'Q3 lỗi', requestId: 'c' }),
    row({ role: 'assistant', content: '', requestId: 'c' }),
    row({ content: 'Q4 đang chạy', requestId: 'd' }),
    row({ role: 'assistant', content: 'A5 mồ côi', requestId: 'e' }),
    row({ content: 'Cũ', requestId: null }), // dữ liệu cũ: ghép với tin ngay sau
    row({ role: 'assistant', content: 'Đáp cũ', requestId: null }),
    row({ threadKey: 'u', updatedAt: '2025-01-01', content: 'Tự động', hidden: true, requestId: 'f' }),
    row({ threadKey: 'u', updatedAt: '2025-01-01', role: 'assistant', content: 'Đáp', requestId: 'f' }),
  ]);
  assert.deepEqual(threads.map(t => t.threadKey), ['u', 't'], 'cũ → mới');
  assert.deepEqual(threads[1].messages.map(m => m.content), ['Q1', 'A1', 'Q2', 'A2', 'Cũ', 'Đáp cũ']);
  assert.deepEqual(threads[0].messages[0], { role: 'user', content: 'Tự động', hidden: true });
}

async function main() {
  pairing();

  const session = await import('../../lib/auth/session');
  const { createMemoryUserStore } = await import('../../lib/users/memory-user-store');
  const { setUserStoreForTest } = await import('../../lib/users');
  const { generateChart } = await import('../../lib/ziwei/algorithm');
  const { POST: interpret } = await import('../../app/api/interpret/route');
  const { POST: heming } = await import('../../app/api/heming/route');
  const { POST: history } = await import('../../app/api/history/route');
  const { POST: close } = await import('../../app/api/history/close/route');

  const envCookie = await envUserCookie();
  const users = createMemoryUserStore();
  setUserStoreForTest(users);
  const member = await users.createUser('khach', 'pbkdf2$1$x$y');
  assert.ok(typeof member === 'object');
  await users.updateUser(member.id, { action: 'approve' });
  await users.updateUser(member.id, { action: 'setLimit', limit: null });
  const memberCookie = `${session.SESSION_COOKIE}=${await session.createMemberToken(member.id, process.env.AUTH_SECRET!)}`;

  const store = createMemoryChatStore();
  setChatStoreForTest(store);

  const chart = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male', name: 'Tên giả' } as never);
  const chartB = generateChart({ year: 1992, month: 8, day: 20, hour: 7, gender: 'female' } as never);
  const ORIGIN = 'http://localhost';
  const call = (fn: (r: Request) => Promise<Response>, path: string, cookie: string | null, payload: unknown, origin = true) => fn(new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(origin ? { origin: ORIGIN } : {}) },
    body: JSON.stringify(payload),
  }));
  type T = { threadKey: string; messages: { role: string; content: string; hidden?: boolean }[] };
  const load = async (cookie: string, payload: unknown = { kind: 'interpret', birthInfo: chart.birthInfo }) => {
    const res = await call(history, '/api/history', cookie, payload);
    assert.equal(res.status, 200);
    return ((await res.json()) as { threads: T[] }).threads;
  };
  const ask = (cookie: string, threadKey: string, messages: unknown[], intent: unknown = { type: 'topic', key: threadKey }) =>
    call(interpret, '/api/interpret', cookie, { chart, intent, threadKey, messages });

  // Chưa đăng nhập / thiếu lá số.
  assert.equal((await call(history, '/api/history', null, { kind: 'interpret', birthInfo: chart.birthInfo })).status, 401);
  assert.equal((await call(history, '/api/history', envCookie, { kind: 'interpret' })).status, 400);
  assert.equal((await call(history, '/api/history', envCookie, { kind: 'heming', birthInfo: chart.birthInfo })).status, 400);
  assert.deepEqual(await load(envCookie), []);

  // Mở Mệnh cách (tự động) → hỏi tiếp → nạp lại đủ, câu tự động bị ẩn.
  reply = 'Mệnh cách 1';
  await drain(await ask(envCookie, 'overview', []));
  reply = 'Đáp tiếp';
  await drain(await ask(envCookie, 'overview', [{ role: 'assistant', content: 'Mệnh cách 1' }, { role: 'user', content: 'Hỏi tiếp?' }]));
  let threads = await load(envCookie);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].threadKey, 'overview');
  assert.equal(threads[0].messages[0].hidden, true, 'câu tự động ẩn');
  assert.deepEqual(threads[0].messages.slice(1).map(m => m.content), ['Mệnh cách 1', 'Hỏi tiếp?', 'Đáp tiếp']);

  // Người khác cùng lá số không thấy; tự hỏi thì có hội thoại riêng.
  assert.deepEqual(await load(memberCookie), []);
  reply = 'Của khách';
  await drain(await ask(memberCookie, 'palace:2', [], { type: 'palace', branch: 2 }));
  assert.deepEqual((await load(memberCookie)).map(t => t.threadKey), ['palace:2']);
  assert.deepEqual((await load(envCookie)).map(t => t.threadKey), ['overview']);

  // Mở mục và hỏi luôn (không tự luận): câu hỏi hiện, không ẩn.
  reply = 'Sự nghiệp ổn';
  await drain(await ask(envCookie, 'career', [{ role: 'user', content: 'Năm nay đổi việc?' }]));
  const career = (await load(envCookie)).find(t => t.threadKey === 'career')!;
  assert.deepEqual(career.messages, [{ role: 'user', content: 'Năm nay đổi việc?' }, { role: 'assistant', content: 'Sự nghiệp ổn' }]);

  // Luận lại (lịch sử rỗng) → chỉ còn lượt mới.
  reply = 'Mệnh cách 2';
  await drain(await ask(envCookie, 'overview', []));
  threads = await load(envCookie);
  assert.deepEqual(threads.find(t => t.threadKey === 'overview')!.messages.filter(m => !m.hidden).map(m => m.content), ['Mệnh cách 2']);

  // Đóng mục → không nạp lại; khác nguồn bị chặn; đóng của người khác không ảnh hưởng.
  const closeBody = { kind: 'interpret', birthInfo: chart.birthInfo, threadKey: 'career' };
  assert.equal((await call(close, '/api/history/close', envCookie, closeBody, false)).status, 403);
  assert.equal((await call(close, '/api/history/close', envCookie, { ...closeBody, threadKey: '' })).status, 400);
  assert.equal((await call(close, '/api/history/close', memberCookie, closeBody)).status, 204);
  assert.ok((await load(envCookie)).some(t => t.threadKey === 'career'));
  assert.equal((await call(close, '/api/history/close', envCookie, closeBody)).status, 204);
  assert.deepEqual((await load(envCookie)).map(t => t.threadKey), ['overview']);
  // Admin vẫn xem được toàn bộ.
  const [summary] = await store.listCharts(0);
  const detail = (await store.getChart(summary.id))!;
  assert.ok(detail.conversations.find(c => c.threadKey === 'career')!.messages.some(m => m.content === 'Sự nghiệp ổn'));

  // Hợp bàn: lượt tổng quan (ẩn) + hỏi thêm; luận lại từ đầu thì chỉ còn lượt mới.
  const hemingBody = { kind: 'heming', birthInfo: chart.birthInfo, partnerBirthInfo: chartB.birthInfo };
  reply = 'Hợp nhau';
  await drain(await call(heming, '/api/heming', envCookie, { chartA: chart, chartB }));
  reply = 'Tài chính được';
  await drain(await call(heming, '/api/heming', envCookie, { chartA: chart, chartB, question: 'Tài chính?', history: [{ answer: 'Hợp nhau' }] }));
  let pair = await load(envCookie, hemingBody);
  assert.equal(pair.length, 1);
  assert.deepEqual(pair[0].messages.map(m => [m.content, !!m.hidden]).slice(1), [['Hợp nhau', false], ['Tài chính?', false], ['Tài chính được', false]]);
  assert.equal(pair[0].messages[0].hidden, true);
  assert.deepEqual(await load(envCookie, { ...hemingBody, partnerBirthInfo: chart.birthInfo }), [], 'cặp khác');
  reply = 'Hợp nhau lần 2';
  await drain(await call(heming, '/api/heming', envCookie, { chartA: chart, chartB }));
  pair = await load(envCookie, hemingBody);
  assert.deepEqual(pair[0].messages.map(m => m.content).slice(1), ['Hợp nhau lần 2']);
  assert.equal((await load(envCookie)).length, 1, 'hợp bàn không lẫn vào mục luận giải');

  setChatStoreForTest(null);
  setUserStoreForTest(null);
  finished = true;
  console.log('chat-history: ok');
}

main().catch(error => { console.error(error); process.exit(1); });
