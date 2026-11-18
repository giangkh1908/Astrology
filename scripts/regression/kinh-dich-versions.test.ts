import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { envUserCookie } from './helpers/session';

// Version prompt Kinh Dịch admin chọn được (kd1 / kd2): lưu riêng khoá settings, mặc định kd2;
// route dùng đúng bộ prompt + tuỳ chọn gọi model của version đó và ghi đúng version.
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_MODEL = 'fake/model';

const enc = new TextEncoder();
type Body = { messages: { role: string; content: string }[]; tools?: unknown[]; session_id?: string; provider?: unknown; max_tokens?: number; reasoning?: unknown };
const bodies: Body[] = [];
globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
  bodies.push(JSON.parse(String(init?.body)));
  return new Response(new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Câu hỏi đã rõ: giả.' } }] })}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n')); c.close();
    },
  }), { status: 200 });
}) as typeof fetch;

let finished = false;
process.on('beforeExit', () => { if (!finished) { console.error('kinh-dich-versions: treo'); process.exit(1); } });
const flush = () => new Promise(r => setTimeout(r, 30));

async function main() {
  const { createMemoryChatStore } = await import('../../lib/store/memory-chat-store');
  const { disabledChatStore, setChatStoreForTest } = await import('../../lib/store');
  const { ACTIVE_PROMPT_KEY } = await import('../../lib/store/chat-store');
  const v = await import('../../lib/kinh-dich/versions');

  // ── Giải version ──
  const chat = createMemoryChatStore();
  assert.equal(await v.resolveKinhDichVersion(chat), 'kd2', 'chưa đặt → kd2');
  await chat.setSetting(v.KINH_DICH_VERSION_KEY, 'kd1');
  assert.equal(await v.resolveKinhDichVersion(chat), 'kd1');
  await chat.setSetting(v.KINH_DICH_VERSION_KEY, 'kd9');
  assert.equal(await v.resolveKinhDichVersion(chat), 'kd2', 'giá trị lạ → kd2');
  assert.equal(await v.resolveKinhDichVersion({ getSetting: async () => { throw new Error('db down'); } }), 'kd2', 'lỗi → kd2');
  assert.equal(await v.resolveKinhDichVersion({ getSetting: () => new Promise(() => undefined) }, 20), 'kd2', 'treo → kd2');
  assert.notEqual(v.KINH_DICH_VERSION_KEY, ACTIVE_PROMPT_KEY, 'khoá riêng với version Tử Vi');
  assert.deepEqual(v.KINH_DICH_VERSIONS.map(x => x.id), ['kd2', 'kd1']);
  assert.ok(!v.isKinhDichVersionId('__proto__'));

  const kd1 = v.kinhDichPromptSet('kd1');
  const kd2 = v.kinhDichPromptSet('kd2');
  assert.equal(kd1.prepareVersion, 'kd1-prepare');
  assert.equal(kd1.readingVersion, 'kd1');
  assert.equal(kd2.prepareVersion, 'kd2-prepare');
  assert.equal(kd2.readingVersion, 'kd2');
  assert.deepEqual(kd1.callOptions('first'), {}, 'kd1 gọi model như trước kd2');
  assert.equal(kd2.callOptions('first', {}).reasoning, 'low');

  // ── Route theo version đang chọn ──
  const { POST } = await import('../../app/api/kinh-dich/route');
  const { createMemoryKinhDichStore } = await import('../../lib/kinh-dich/store-memory');
  const { setKinhDichStoreForTest } = await import('../../lib/kinh-dich/store');
  const kdStore = createMemoryKinhDichStore();
  setKinhDichStoreForTest(kdStore);
  const cookie = await envUserCookie();
  const post = async (payload: Record<string, unknown>) => {
    bodies.length = 0;
    const res = await POST(new Request('http://localhost/api/kinh-dich', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(payload),
    }));
    await res.text();
    await flush();
    return res;
  };
  const system = () => bodies[0].messages[0].content;
  const lines = [9, 8, 7, 8, 7, 8];

  // kd1
  const routeChat = createMemoryChatStore();
  setChatStoreForTest(routeChat);
  await routeChat.setSetting(v.KINH_DICH_VERSION_KEY, 'kd1');
  const p1 = await post({ messages: [{ role: 'user', content: 'Năm nay có nên đổi việc không?' }] });
  assert.equal(p1.headers.get('X-Prompt-Version'), 'kd1-prepare');
  assert.ok(system().includes('cần rõ bốn ý'), 'prompt làm rõ của kd1');
  const castId1 = p1.headers.get('X-Cast-Id')!;
  const r1 = await post({ castId: castId1, lines });
  assert.equal(r1.headers.get('X-Prompt-Version'), 'kd1');
  assert.ok(system().includes('【Trả lời thẳng】'), 'prompt luận của kd1');
  assert.ok(!system().includes('<du_kien_chot>'));
  assert.equal(bodies[0].session_id, undefined, 'kd1 không session_id');
  assert.deepEqual(bodies[0].reasoning, { enabled: false }, 'kd1 không suy luận');
  assert.notEqual(bodies[0].max_tokens, 20000);
  const cast1 = await kdStore.getCast(null, castId1);
  assert.ok(cast1!.messages.some(m => m.role === 'assistant'), 'lượt kd1 được lưu');

  // kd2 (mặc định khi chưa đặt)
  setChatStoreForTest(createMemoryChatStore());
  const p2 = await post({ messages: [{ role: 'user', content: 'Năm nay có nên đổi việc không?' }] });
  assert.equal(p2.headers.get('X-Prompt-Version'), 'kd2-prepare');
  const r2 = await post({ castId: p2.headers.get('X-Cast-Id'), lines });
  assert.equal(r2.headers.get('X-Prompt-Version'), 'kd2');
  assert.ok(system().includes('<du_kien_chot>'));
  assert.equal(bodies[0].session_id, 'kinh-dich-v2');
  assert.deepEqual(bodies[0].reasoning, { effort: 'low' });

  // Chat store tắt → kd2.
  setChatStoreForTest(disabledChatStore);
  const p3 = await post({ messages: [{ role: 'user', content: 'Năm nay có nên đổi việc không?' }] });
  assert.equal(p3.headers.get('X-Prompt-Version'), 'kd2-prepare');

  // ── API admin ──
  process.env.ADMIN_USERNAME = 'boss';
  process.env.ADMIN_PASSWORD = 'fake-admin-password-456';
  const { ADMIN_COOKIE, createSessionToken, readAdminConfig } = await import('../../lib/auth/session');
  const token = await createSessionToken(readAdminConfig()!);
  const { GET: aGET, POST: aPOST } = await import('../../app/api/admin/kinh-dich-version/route');
  const areq = (method: 'GET' | 'POST', body?: unknown, admin = true) => new NextRequest('http://localhost/api/admin/kinh-dich-version', {
    method,
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost', ...(admin ? { cookie: `${ADMIN_COOKIE}=${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const adminChat = createMemoryChatStore();
  setChatStoreForTest(adminChat);
  assert.equal((await aGET(areq('GET', undefined, false))).status, 401);
  assert.equal((await aPOST(areq('POST', { version: 'kd1' }, false))).status, 401);
  assert.equal((await (await aGET(areq('GET'))).json()).active, 'kd2');
  const ok = await aPOST(areq('POST', { version: 'kd1' }));
  assert.equal(ok.status, 200);
  assert.equal(await adminChat.getSetting(v.KINH_DICH_VERSION_KEY), 'kd1');
  assert.equal(await adminChat.getSetting(ACTIVE_PROMPT_KEY), null, 'không đụng version Tử Vi');
  assert.equal((await aPOST(areq('POST', { version: 'v1' }))).status, 400, 'version Tử Vi không hợp lệ ở đây');
  setChatStoreForTest(disabledChatStore);
  assert.equal((await aPOST(areq('POST', { version: 'kd2' }))).status, 503);

  setChatStoreForTest(null);
  setKinhDichStoreForTest(null);
  finished = true;
  console.log('kinh-dich-versions: ok');
}

main().catch(e => { console.error(e); process.exit(1); });
