import assert from 'node:assert/strict';

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
  const chartA = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male' } as never);
  const chartB = generateChart({ year: 1992, month: 8, day: 20, hour: 7, gender: 'female' } as never);
  const call = (payload: unknown) => POST(new Request('http://localhost/api/heming', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));

  // Thiếu một lá số → 400, không gọi AI
  assert.equal((await call({ chartA })).status, 400);
  assert.equal(sentBody, null);
  assert.equal((await call({ chartA, chartB, question: 42 })).status, 400);

  // Phân tích mặc định
  const res = await call({ chartA, chartB });
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('"text":"Hợp"'));
  const first = sentBody!;
  assert.deepEqual(first.reasoning, { enabled: false });
  assert.equal(first.messages[0].role, 'system');
  assert.ok(first.messages[0].content.includes('Người A') && first.messages[0].content.includes('Người B'));
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
    ['user', 'Hãy phân tích mức độ hợp duyên giữa Người A và Người B, nêu căn cứ cụ thể từ hai lá số.'],
    ['assistant', 'Tổng quan'],
    ['user', 'Hợp làm ăn?'],
    ['assistant', 'Có'],
    ['user', 'Còn kết hôn?'],
  ]);

  console.log('heming-route: ok');
}

main().catch(error => { console.error(error); process.exit(1); });
