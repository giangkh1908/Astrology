import assert from 'node:assert/strict';
import { readSse } from '../../lib/kinh-dich/sse';

// Đọc luồng SSE nội bộ: gói bị cắt giữa chừng, delta/ask/status/error, dừng ở [DONE].
const enc = new TextEncoder();
const streamOf = (chunks: string[]) => new ReadableStream<Uint8Array>({
  start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); },
});

async function main() {
  const whole = [
    `data: ${JSON.stringify({ status: 'Đang tra' })}\n\n`,
    `data: ${JSON.stringify({ delta: { text: 'Xin ' } })}\n\n`,
    `data: ${JSON.stringify({ delta: { text: 'chào' } })}\n\n`,
    `data: ${JSON.stringify({ ask: { loi_dan: 'Hỏi', cau_hoi: [] } })}\n\n`,
    `data: ${JSON.stringify({ error: 'đứt' })}\n\n`,
    'data: [DONE]\n\n',
    `data: ${JSON.stringify({ delta: { text: 'sau DONE' } })}\n\n`,
  ].join('');
  // cắt thành từng mẩu 7 byte để có dòng bị chia đôi (kể cả giữa ký tự nhiều byte)
  const bytes = enc.encode(whole);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += 7) parts.push(bytes.slice(i, i + 7));
  const body = new ReadableStream<Uint8Array>({ start(c) { for (const p of parts) c.enqueue(p); c.close(); } });

  const got: string[] = [];
  await readSse(body, {
    delta: t => got.push(`d:${t}`),
    ask: a => got.push(`a:${(a as { loi_dan: string }).loi_dan}`),
    status: s => got.push(`s:${s}`),
    error: e => got.push(`e:${e}`),
  });
  assert.deepEqual(got, ['s:Đang tra', 'd:Xin ', 'd:chào', 'a:Hỏi', 'e:đứt']);

  // Dòng rác bị bỏ qua, không ném lỗi
  const junk: string[] = [];
  await readSse(streamOf(['data: {hỏng\n\n', ': comment\n\n', `data: ${JSON.stringify({ delta: { text: 'ok' } })}\n\n`]), { delta: t => junk.push(t) });
  assert.deepEqual(junk, ['ok']);
  console.log('kinh-dich-sse: ok');
}
main().catch(e => { console.error(e); process.exit(1); });
