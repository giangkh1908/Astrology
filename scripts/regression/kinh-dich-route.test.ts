import assert from 'node:assert/strict';
import { encodeAsk, type AskPayload } from '../../lib/ai/ask-user';
import { envUserCookie } from './helpers/session';

// Route /api/kinh-dich: làm rõ câu hỏi trước khi gieo, gieo + luận, hỏi tiếp; một quẻ = 1 lượt; dữ liệu giả.
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_MODEL = 'fake/model';

const enc = new TextEncoder();
const ask: AskPayload = {
  loi_dan: 'Cho mình hỏi thêm:',
  cau_hoi: [{ nhan: 'Cho ai', noi_dung: 'Bạn hỏi cho ai?', lua_chon: [{ tieu_de: 'Bản thân' }, { tieu_de: 'Người thân' }] }],
};
type Body = { messages: { role: string; content: string }[]; tools?: { function: { name: string } }[] };
const bodies: Body[] = [];
let reply: 'text' | 'ask' = 'text';
globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
  bodies.push(JSON.parse(String(init?.body)));
  const event = reply === 'ask'
    ? { choices: [{ delta: { tool_calls: [{ index: 0, id: 'a1', type: 'function', function: { name: 'hoi_nguoi_dung', arguments: JSON.stringify(ask) } }] } }] }
    : { choices: [{ delta: { content: 'Câu trả lời giả' } }] };
  return new Response(new ReadableStream({
    start(c) { c.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`)); c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); },
  }), { status: 200 });
}) as typeof fetch;

let finished = false;
process.on('beforeExit', () => { if (!finished) { console.error('kinh-dich-route: treo'); process.exit(1); } });
const flush = () => new Promise(r => setTimeout(r, 30));
const toolNames = (b: Body) => (b.tools ?? []).map(t => t.function.name);
const system = () => bodies[0].messages[0].content;

async function main() {
  const { POST, GET } = await import('../../app/api/kinh-dich/route');
  const { createMemoryKinhDichStore } = await import('../../lib/kinh-dich/store-memory');
  const { disabledKinhDichStore, setKinhDichStoreForTest } = await import('../../lib/kinh-dich/store');
  const { createMemoryUserStore } = await import('../../lib/users/memory-user-store');
  const { setUserStoreForTest } = await import('../../lib/users');
  const { createMemberToken, SESSION_COOKIE } = await import('../../lib/auth/session');
  const { hexagramText } = await import('../../lib/kinh-dich/texts');

  const store = createMemoryKinhDichStore();
  setKinhDichStoreForTest(store);
  const users = createMemoryUserStore();
  setUserStoreForTest(users);
  const envCookie = await envUserCookie();
  const created = await users.createUser('member-kd', 'hash');
  assert.ok(typeof created === 'object');
  await users.updateUser(created.id, { action: 'approve' });
  const memberCookie = `${SESSION_COOKIE}=${await createMemberToken(created.id, process.env.AUTH_SECRET!)}`;
  const used = async () => (await users.getById(created.id))!.chatUsed;

  const post = async (payload: Record<string, unknown>, cookie: string | null = memberCookie) => {
    bodies.length = 0;
    const res = await POST(new Request('http://localhost/api/kinh-dich', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(payload),
    }));
    const text = await res.text();
    await flush();
    return { res, text };
  };
  const get = async (query = '', cookie = memberCookie) => GET(new Request(`http://localhost/api/kinh-dich${query}`, { headers: { cookie } }));
  const user = (content: string) => ({ role: 'user', content });

  // Chưa đăng nhập / dữ liệu sai
  assert.equal((await post({ messages: [user('Hỏi')] }, null)).res.status, 401);
  assert.equal((await post({ messages: [user('   ')] })).res.status, 400);
  assert.equal((await post({ messages: [user('x'.repeat(501))] })).res.status, 400);
  assert.equal((await post({ messages: [] })).res.status, 400);
  assert.equal(await used(), 0, 'lỗi dữ liệu không trừ lượt');

  // Lượt 1: mở lần gieo → làm rõ (có tool hỏi lại, prompt làm rõ, không có dữ kiện quẻ), trừ 1 lượt
  reply = 'ask';
  const q1 = 'Có nên nhận lời mời làm việc ở công ty mới không?';
  const r1 = await post({ messages: [user(q1)] });
  assert.equal(r1.res.status, 200);
  const castId = r1.res.headers.get('X-Cast-Id')!;
  assert.match(castId, /^[0-9a-f-]{36}$/);
  assert.equal(r1.res.headers.get('X-Chat-Quota'), '1/' + ((await users.getById(created.id))!.chatLimit ?? 'unlimited'));
  assert.ok(toolNames(bodies[0]).includes('hoi_nguoi_dung'));
  assert.ok(system().includes('Câu hỏi đã rõ'));
  assert.ok(!system().includes('Dữ kiện quẻ'));
  assert.equal(await used(), 1);
  assert.equal((await store.getCast(created.id, castId))!.lastAssistantStatus, 'asked');

  // Lượt 2: trả lời thẻ → vẫn làm rõ, miễn phí; lịch sử lấy từ store (thẻ hỏi thành văn bản)
  reply = 'text';
  const r2 = await post({ castId, messages: [user(q1), { role: 'assistant', content: 'giả mạo' }, user('Trả lời câu hỏi:\n- Cho ai: Bản thân')], answering: true });
  assert.equal(r2.res.status, 200);
  assert.equal(await used(), 1, 'làm rõ trước khi gieo miễn phí');
  const sent = JSON.stringify(bodies[0].messages);
  assert.ok(sent.includes('Bạn hỏi cho ai?'));
  assert.ok(!sent.includes('<!--ask:'));
  assert.ok(!sent.includes('giả mạo'), 'không tin tin assistant client gửi');

  // Gieo + luận: lưu quẻ, prompt luận có dữ kiện quẻ, không có tool hỏi lại, miễn phí
  const lines = [9, 7, 7, 7, 7, 7];
  const r3 = await post({ castId, lines, messages: [] });
  assert.equal(r3.res.status, 200);
  assert.equal(await used(), 1, 'bài luận đầu miễn phí');
  assert.ok(system().includes('Dữ kiện quẻ (JSON):'));
  assert.ok(system().includes(hexagramText(1).lines[0].textHV));
  assert.ok(system().includes('không được tự đổi quẻ hay tự chế lời kinh'));
  assert.ok(!toolNames(bodies[0]).includes('hoi_nguoi_dung'));
  assert.ok(JSON.stringify(bodies[0].messages).includes('Bản thân'), 'đoạn làm rõ đi kèm bài luận');
  assert.deepEqual((await store.getCast(created.id, castId))!.lines, lines);

  // Gieo lần hai → 409, quẻ không đổi, không trừ lượt
  const r4 = await post({ castId, lines: [6, 6, 6, 6, 6, 6], messages: [] });
  assert.equal(r4.res.status, 409);
  assert.deepEqual((await store.getCast(created.id, castId))!.lines, lines);
  assert.equal(await used(), 1);

  // Hỏi tiếp: trừ lượt; lines trong body bị bỏ qua; có tool hỏi lại
  const r5 = await post({ castId, lines: [8, 8, 8, 8, 8, 8], messages: [user('Vậy tháng sau có nên nộp đơn nghỉ không?')] });
  assert.equal(r5.res.status, 200);
  assert.equal(await used(), 2);
  assert.ok(system().includes('"quẻ_chính":{"số":1'), 'vẫn là quẻ đã lưu');
  assert.ok(toolNames(bodies[0]).includes('hoi_nguoi_dung'));

  // lines sai
  const other = await post({ messages: [user('Chuyển nhà tháng sau được không?')] });
  const castId2 = other.res.headers.get('X-Cast-Id')!;
  assert.equal(await used(), 3);
  assert.equal((await post({ castId: castId2, lines: [7, 7, 7], messages: [] })).res.status, 400);
  // Memory của lần gieo 2: có câu hỏi + quẻ lần 1 và câu trả lời thẻ; không có chính câu hỏi lần 2 dưới dạng lời kể cũ
  assert.ok(other.res.status === 200);
  const r6 = await post({ castId: castId2, messages: [user('Trả lời câu hỏi:\n- Thời gian: 3 tháng')] });
  assert.equal(r6.res.status, 200);
  assert.ok(system().includes('Những điều người dùng đã kể ở các lần gieo trước'));
  assert.ok(system().includes(q1));
  assert.ok(system().includes('Thuần Càn'));

  // Quá số lượt làm rõ → 409
  for (let i = 0; i < 2; i++) await post({ castId: castId2, messages: [user(`Thêm ý ${i}`)] });
  assert.equal((await post({ castId: castId2, messages: [user('Thêm nữa')] })).res.status, 409);

  // castId của chủ khác / không tồn tại → 404
  assert.equal((await post({ castId, messages: [user('Hỏi trộm')] }, envCookie)).res.status, 404);
  assert.equal((await post({ castId: '00000000-0000-4000-8000-000000000000', messages: [user('Hỏi')] })).res.status, 404);
  assert.equal((await post({ castId: 'abc', messages: [user('Hỏi')] })).res.status, 404);

  // GET: danh sách và chi tiết; chủ khác không thấy
  const list = await (await get()).json();
  assert.deepEqual(list.casts.map((c: { castId: string }) => c.castId), [castId2, castId]);
  assert.equal(list.casts[1].main, 'Thuần Càn');
  const detail = await (await get(`?castId=${castId}`)).json();
  assert.equal(detail.cast.question, q1);
  assert.equal(detail.reading.main.number, 1);
  assert.ok(detail.cast.messages.length >= 4);
  assert.equal((await get(`?castId=${castId}`, envCookie)).status, 404);
  assert.equal((await GET(new Request('http://localhost/api/kinh-dich'))).status, 401);

  // Store tắt: không có trạng thái → giai đoạn suy từ body, mỗi lượt qua chargeChat, không X-Cast-Id
  setKinhDichStoreForTest(disabledKinhDichStore);
  const d1 = await post({ messages: [user(q1)] }, envCookie);
  assert.equal(d1.res.status, 200);
  assert.equal(d1.res.headers.get('X-Cast-Id'), null);
  assert.ok(system().includes('Câu hỏi đã rõ'));
  const d2 = await post({ lines, messages: [user(q1), { role: 'assistant', content: encodeAsk(ask) }, user('Trả lời câu hỏi:\n- Cho ai: Bản thân')] }, envCookie);
  assert.equal(d2.res.status, 200);
  assert.ok(system().includes('Dữ kiện quẻ (JSON):'));
  assert.ok(!JSON.stringify(bodies[0].messages).includes('<!--ask:'));
  assert.deepEqual((await (await get('', envCookie)).json()).casts, []);

  setKinhDichStoreForTest(null);
  setUserStoreForTest(null);
  finished = true;
  console.log('kinh-dich-route: ok');
}
main().catch(error => { console.error(error); process.exit(1); });
