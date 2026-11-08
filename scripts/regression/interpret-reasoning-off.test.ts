import assert from 'node:assert/strict';

// Route chỉ chuyển tiếp delta.content; nếu model bật reasoning, chữ đầu tiên
// chỉ xuất hiện sau khi model nghĩ xong → khung chat đứng ở "Đang luận giải…".
async function main() {
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'fake/model';

  let sentBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body));
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Xin chào"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;

  const { POST } = await import('../../app/api/interpret/route');
  const { generateChart } = await import('../../lib/ziwei/algorithm');
  const chart = generateChart({ year: 2000, month: 1, day: 1, hour: 0, gender: 'male' } as never);

  const res = await POST(new Request('http://localhost/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart, messages: [{ role: 'user', content: 'Hỏi thử' }] }),
  }));

  assert.equal(res.status, 200);
  assert.ok(sentBody, 'Route phải gọi nhà cung cấp AI');
  const body = sentBody as Record<string, unknown>;
  assert.equal(body.stream, true);
  assert.deepEqual(body.reasoning, { enabled: false });
  assert.ok((await res.text()).includes('"text":"Xin chào"'), 'Phải chuyển tiếp nội dung stream');
  console.log('interpret-reasoning-off: ok');
}

main().catch(error => { console.error(error); process.exit(1); });
