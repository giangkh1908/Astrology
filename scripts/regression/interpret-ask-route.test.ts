import assert from 'node:assert/strict';
import { ACTIVE_PROMPT_KEY } from '../../lib/store/chat-store';
import { createMemoryChatStore } from '../../lib/store/memory-chat-store';
import { disabledChatStore, setChatStoreForTest } from '../../lib/store';
import { encodeAsk, type AskPayload } from '../../lib/ai/ask-user';
import { envUserCookie } from './helpers/session';

// Route /api/interpret với prompt v3: gửi tool hỏi lại, đổi thẻ hỏi thành văn bản cho model,
// lưu status 'asked', trả lời thẻ hỏi không trừ lượt (chỉ khi tin assistant cuối trong DB đúng là 'asked').
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_MODEL = 'fake/model';

const enc = new TextEncoder();
const ask: AskPayload = {
  loi_dan: 'Cho mình hỏi thêm:',
  cau_hoi: [{ nhan: 'Hôn nhân', noi_dung: 'Bạn đã lập gia đình chưa?', lua_chon: [{ tieu_de: 'Rồi' }, { tieu_de: 'Chưa' }] }],
};
type Body = { messages: { role: string; content: string }[]; tools?: { function: { name: string } }[] };
const bodies: Body[] = [];
let reply: 'text' | 'ask' = 'text';
globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
  bodies.push(JSON.parse(String(init?.body)));
  const event = reply === 'ask'
    ? { choices: [{ delta: { tool_calls: [{ index: 0, id: 'a1', type: 'function', function: { name: 'hoi_nguoi_dung', arguments: JSON.stringify(ask) } }] } }] }
    : { choices: [{ delta: { content: 'Bài luận giả' } }] };
  return new Response(new ReadableStream({
    start(c) { c.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`)); c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); },
  }), { status: 200 });
}) as typeof fetch;

let finished = false;
process.on('beforeExit', () => { if (!finished) { console.error('interpret-ask-route: treo'); process.exit(1); } });
const flush = () => new Promise(r => setTimeout(r, 30));
const toolNames = (b: Body) => (b.tools ?? []).map(t => t.function.name);

async function main() {
  const { generateChart } = await import('../../lib/ziwei/algorithm');
  const { POST: interpret } = await import('../../app/api/interpret/route');
  const { GET: account } = await import('../../app/api/account/route');
  const { createMemoryUserStore } = await import('../../lib/users/memory-user-store');
  const { setUserStoreForTest } = await import('../../lib/users');
  const { createMemberToken, SESSION_COOKIE } = await import('../../lib/auth/session');
  const chart = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male', name: 'Tên giả' } as never);
  const envCookie = await envUserCookie();
  const post = async (payload: Record<string, unknown>, cookie = envCookie) => {
    bodies.length = 0;
    const res = await interpret(new Request('http://localhost/api/interpret', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ chart, intent: { type: 'topic', key: 'love' }, threadKey: 'love', ...payload }),
    }));
    await res.text();
    await flush();
    return res;
  };
  const turn = (q: string) => [{ role: 'user', content: q }];
  const asked = { role: 'assistant', content: encodeAsk(ask) };

  const store = createMemoryChatStore();
  setChatStoreForTest(store);

  // v2: không có tool hỏi lại; header báo version
  await store.setSetting(ACTIVE_PROMPT_KEY, 'v2');
  const r0 = await post({ messages: turn('Tình duyên?') });
  assert.ok(!toolNames(bodies[0]).includes('hoi_nguoi_dung'));
  assert.equal(r0.headers.get('X-Prompt-Version'), 'v2');

  await store.setSetting(ACTIVE_PROMPT_KEY, 'v3');

  // v3: có tool hỏi lại, header v3, khung tháng client gửi vào prompt
  const r1 = await post({ messages: turn('Tình duyên?'), timeContext: { window: { lunarYear: 2026, startMonth: 11 } } });
  assert.ok(toolNames(bodies[0]).includes('hoi_nguoi_dung'));
  assert.equal(r1.headers.get('X-Prompt-Version'), 'v3');
  assert.ok(bodies[0].messages[0].content.includes('tháng 11/2026 – 1/2027 âm'));

  // Câu hỏi tự động mở mục: không được hỏi lại
  await post({ messages: [] });
  assert.ok(!toolNames(bodies[0]).includes('hoi_nguoi_dung'));

  // Đã hỏi 2 lần liên tiếp → không gửi tool nữa; thẻ hỏi trong lịch sử đổi thành văn bản thường
  await post({ messages: [...turn('Tình duyên?'), asked, ...turn('Trả lời câu hỏi:\n- Hôn nhân: Rồi'), asked, ...turn('Trả lời câu hỏi:\n- Con: Chưa')], answering: true });
  assert.ok(!toolNames(bodies[0]).includes('hoi_nguoi_dung'));
  assert.ok(!JSON.stringify(bodies[0].messages).includes('<!--ask:'));
  assert.ok(JSON.stringify(bodies[0].messages).includes('Bạn đã lập gia đình chưa?'));

  // Model hỏi lại → tin assistant lưu status 'asked'
  reply = 'ask';
  await post({ messages: turn('Năm nay cưới không?') });
  const q = { kind: 'interpret' as const, chartKey: (await store.listCharts(0))[0].key, userId: null, threadKey: 'love' };
  assert.equal(await store.lastAssistantStatus(q), 'asked');
  reply = 'text';

  // Tài khoản member: trả lời thẻ hỏi không trừ lượt; trả lời giả (tin cuối không phải 'asked') thì trừ
  const users = createMemoryUserStore();
  setUserStoreForTest(users);
  const created = await users.createUser('member1', 'hash');
  assert.ok(typeof created === 'object');
  await users.updateUser(created.id, { action: 'approve' });
  const memberCookie = `${SESSION_COOKIE}=${await createMemberToken(created.id, process.env.AUTH_SECRET!)}`;
  const used = async () => (await users.getById(created.id))!.chatUsed;

  reply = 'ask';
  await post({ messages: turn('Năm nay cưới không?') }, memberCookie);
  assert.equal(await used(), 1);
  reply = 'text';
  const r2 = await post({ messages: [...turn('Năm nay cưới không?'), asked, ...turn('Trả lời câu hỏi:\n- Hôn nhân: Chưa')], answering: true }, memberCookie);
  assert.equal(r2.status, 200);
  assert.equal(await used(), 1, 'trả lời thẻ hỏi không trừ lượt');
  // Tin assistant cuối giờ là bài luận 'ok' → answering:true giả vẫn bị trừ
  await post({ messages: [...turn('Năm nay cưới không?'), asked, ...turn('Trả lời câu hỏi:\n- Hôn nhân: Chưa')], answering: true }, memberCookie);
  assert.equal(await used(), 2, 'answering giả vẫn trừ lượt');

  // /api/account trả version đang chạy
  const acc = await (await account(new Request('http://localhost/api/account', { headers: { cookie: memberCookie } }))).json();
  assert.equal(acc.promptVersion, 'v3');

  // Store tắt: không kiểm được → answering:true vẫn trừ lượt, vẫn trả lời
  setChatStoreForTest(disabledChatStore);
  const r3 = await post({ messages: [...turn('Hỏi'), asked, ...turn('Trả lời câu hỏi:\n- Hôn nhân: Chưa')], answering: true }, memberCookie);
  assert.equal(r3.status, 200);
  assert.equal(await used(), 3);

  setChatStoreForTest(null);
  setUserStoreForTest(null);
  finished = true;
  console.log('interpret-ask-route: ok');
}
main().catch(error => { console.error(error); process.exit(1); });
