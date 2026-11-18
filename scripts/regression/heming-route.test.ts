import assert from 'node:assert/strict';
import { envUserCookie } from './helpers/session';

// Trang Hợp bàn gọi POST /api/heming và đọc SSE `data: {"delta":{"text":...}}`.
// Route từng bị thiếu → trang luôn báo "Tạm thời không phân tích được".
async function main() {
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'fake/model';

  let sentBody: { messages: { role: string; content: string }[]; reasoning?: unknown } | null = null;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body));
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hợp"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }), { status: 200 });
  }) as typeof fetch;

  const { POST } = await import('../../app/api/heming/route');
  const { generateChart } = await import('../../lib/ziwei/algorithm');
  const chartA = generateChart({ name: 'Minh', year: 1990, month: 3, day: 5, hour: 2, gender: 'male' } as never);
  const chartB = generateChart({ name: 'Lan', year: 1992, month: 8, day: 20, hour: 7, gender: 'female' } as never);
  assert.equal(chartA.birthInfo.name, 'Minh', 'lá số phải giữ tên trong birthInfo');
  const call = async (payload: unknown) => POST(new Request('http://localhost/api/heming', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: await envUserCookie() },
    body: JSON.stringify(payload),
  }));

  // Thiếu một lá số → 400, không gọi AI
  assert.equal((await call({ chartA })).status, 400);
  assert.equal(sentBody, null);
  assert.equal((await call({ chartA, chartB, question: 42 })).status, 400);
  // Bắt buộc tên cả hai người (tên rỗng / chỉ ký tự điều khiển cũng tính là thiếu) → 400, không gọi AI
  const noName = (c: typeof chartA, name: unknown) => ({ ...c, birthInfo: { ...c.birthInfo, name } });
  for (const bad of [undefined, '', '   ', '\n\t\u0000', 42]) {
    const r = await call({ chartA: noName(chartA, bad), chartB });
    assert.equal(r.status, 400, `tên ${JSON.stringify(bad)} phải bị từ chối`);
    assert.match((await r.json()).error, /tên/i);
  }
  assert.equal((await call({ chartA, chartB: noName(chartB, undefined) })).status, 400);
  assert.equal(sentBody, null);

  // Phân tích mặc định
  const res = await call({ chartA, chartB });
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('"text":"Hợp"'));
  const first = sentBody!;
  assert.deepEqual(first.reasoning, { enabled: false });
  assert.equal(first.messages[0].role, 'system');
  assert.ok(first.messages[0].content.includes('"Minh"') && first.messages[0].content.includes('"Lan"'), 'prompt phải gọi tên hai người');
  assert.doesNotMatch(first.messages[0].content, /Người [AB]\b/, 'prompt không còn Người A/B');
  assert.equal(first.messages[1].role, 'user');

  // Câu hỏi riêng được chuyển nguyên văn
  await (await call({ chartA, chartB, question: 'Hai người có hợp làm ăn chung không?' })).text();
  assert.equal(sentBody!.messages[1].content, 'Hai người có hợp làm ăn chung không?');

  // Dữ kiện lá số gửi cho AI không còn chữ Hán (cục, độ sáng, tứ hóa đại hạn…)
  const cjk = first.messages[0].content.match(/[㐀-鿿]+/g);
  assert.equal(cjk, null, `Prompt còn chữ Hán: ${cjk?.slice(0, 10).join(' ')}`);

  // Lịch sử các lượt trước được chuyển thành hội thoại trước câu hỏi mới
  await (await call({
    chartA, chartB, question: 'Còn kết hôn?',
    history: [{ answer: 'Tổng quan' }, { question: 'Hợp làm ăn?', answer: 'Có' }, { answer: '' }, 'rác'],
  })).text();
  assert.deepEqual(sentBody!.messages.slice(1).map(m => [m.role, m.content]), [
    ['user', 'Hãy phân tích mức độ hợp duyên giữa hai người, nêu căn cứ cụ thể từ hai lá số.'],
    ['assistant', 'Tổng quan'],
    ['user', 'Hợp làm ăn?'],
    ['assistant', 'Có'],
    ['user', 'Còn kết hôn?'],
  ]);

  // Hợp bàn có tool: lượt đầu gửi danh sách tool hai người, model gọi tool → kết quả gửi lại → trả lời.
  const tools = (first as unknown as { tools?: { function: { name: string } }[] }).tools?.map(t => t.function.name) ?? [];
  for (const name of ['xem_van_han', 'xem_cung', 'xem_cac_thang', 'quet_cac_nam', 'xem_tu_hoa', 'doi_chieu_hai_la_so']) {
    assert.ok(tools.includes(name), `heming chưa gửi tool ${name}`);
  }
  assert.ok(!tools.includes('hoi_nguoi_dung'), 'hợp bàn không có thẻ hỏi lại');
  const vanHanDef = (first as unknown as { tools: { function: { name: string; parameters: { properties: { nguoi: { enum: string[] } } } } }[] })
    .tools.find(t => t.function.name === 'xem_van_han')!;
  assert.deepEqual(vanHanDef.function.parameters.properties.nguoi.enum, ['Minh', 'Lan']);

  // Lịch sử hợp bàn cũ (câu hỏi tự động có "Người A/B") vẫn được nhận là câu hỏi tự động để ẩn khi nạp lại.
  const { autoQuestionsOf } = await import('../../lib/store/history-request');
  const auto = autoQuestionsOf('heming', 'heming');
  assert.ok(auto.has('Hãy phân tích mức độ hợp duyên giữa Người A và Người B, nêu căn cứ cụ thể từ hai lá số.'));
  assert.ok(auto.has('Hãy phân tích mức độ hợp duyên giữa hai người, nêu căn cứ cụ thể từ hai lá số.'));

  const bodies: { messages: Record<string, unknown>[] }[] = [];
  const encoder = new TextEncoder();
  const sse = (events: unknown[]) => new Response(new ReadableStream({
    start(c) { for (const e of events) c.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)); c.enqueue(encoder.encode('data: [DONE]\n\n')); c.close(); },
  }), { status: 200 });
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return bodies.length === 1
      ? sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 't1', type: 'function', function: { name: 'xem_van_han', arguments: '{"nguoi":"Lan","nam":2026}' } }] } }] }])
      : sse([{ choices: [{ delta: { content: 'Năm nay Lan thuận.' } }] }]);
  }) as typeof fetch;
  const toolRes = await call({ chartA, chartB, question: 'Năm nay Lan thế nào?' });
  const toolText = await toolRes.text();
  assert.equal(bodies.length, 2);
  assert.match(toolText, /"status":"[^"]*của Lan"/, 'phải phát trạng thái tra cứu cho UI, gọi bằng tên');
  assert.ok(toolText.includes('"text":"Năm nay Lan thuận."'));
  const toolMsg = bodies[1].messages.at(-1)!;
  assert.equal(toolMsg.role, 'tool');
  const result = JSON.parse(String(toolMsg.content));
  assert.equal(result.năm_âm_lịch, 2026);
  assert.ok(result.dương_lịch, 'kết quả tool phải kèm dương lịch');

  console.log('heming-route: ok');
}

main().catch(error => { console.error(error); process.exit(1); });
