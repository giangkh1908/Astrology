import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Hỏi thêm ở trang Hợp bàn phải giữ các lượt cũ và gửi kèm lịch sử;
// "Bắt đầu/Hợp bàn lại" hoặc đổi ngày sinh thì bắt đầu lại.
const source = readFileSync(new URL('../../app/heming/page.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  // 表单是否填齐');
const end = source.indexOf('  const cardStyle =', start);
assert.ok(start >= 0 && end > start);
const body = `export function makeRun(ctx) {
  const {chartA,chartB,formA,formB,generateChart,formToBirthInfo,setFormError,
    setAnalyzing,setTurns,turnsRef,lastTurnRef,setAnalysisError,setChartA,setChartB,fetch: apiRequest,
    analysisRef} = ctx;
  const useCallback = (fn) => fn;
  ${source.slice(start, end)}
  return runAnalysis;
}`;
const moduleExports: Record<string, (ctx: object) => (q?: string) => Promise<void>> = {};
new Function('exports', 'setTimeout', ts.transpileModule(body, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(moduleExports, () => {});

type Turn = { question: string | null; answer: string; error?: boolean };
const noop = () => {};
const form = { year: '1990', month: '1', day: '1', gender: 'male', clockHour: '8', clockMinute: '0' };
let year = 1990;
let chartA: unknown = null;
let chartB: unknown = null;
let turns: Turn[] = [];
const turnsRef = { current: [] as Turn[] };
const requests: { question?: string; history: { question?: string; answer: string }[] }[] = [];
let reply = '';

const run = (q?: string) => moduleExports.makeRun({
  chartA, chartB, formA: form, formB: form,
  generateChart: async () => ({ birthInfo: { year } }),
  formToBirthInfo: () => ({}),
  setChartA: (v: unknown) => { chartA = v; }, setChartB: (v: unknown) => { chartB = v; },
  setFormError: noop, setAnalyzing: noop, setAnalysisError: noop,
  setTurns: (v: Turn[]) => { turns = v; }, turnsRef, lastTurnRef: { current: null }, analysisRef: { current: null },
  fetch: async (_url: string, init: { body: string }) => {
    requests.push(JSON.parse(init.body));
    const bytes = new TextEncoder().encode(`data: ${JSON.stringify({ delta: { text: reply } })}\n\ndata: [DONE]\n\n`);
    return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }) };
  },
})(q);

async function main() {
  reply = 'Tổng quan';
  await run();
  assert.deepEqual(turns, [{ question: null, answer: 'Tổng quan' }]);
  assert.deepEqual(requests[0].history, []);

  reply = 'Trả lời 1';
  await run('Hợp làm ăn không?');
  assert.equal(turns.length, 2, 'lượt cũ phải được giữ lại');
  assert.equal(turns[0].answer, 'Tổng quan');
  assert.deepEqual(turns[1], { question: 'Hợp làm ăn không?', answer: 'Trả lời 1' });
  assert.equal(requests[1].question, 'Hợp làm ăn không?');
  assert.deepEqual(requests[1].history, [{ answer: 'Tổng quan' }]);

  reply = 'Trả lời 2';
  await run('Còn kết hôn?');
  assert.equal(turns.length, 3);
  assert.deepEqual(requests[2].history.map(h => h.answer), ['Tổng quan', 'Trả lời 1']);

  // Đổi ngày sinh rồi hỏi tiếp → lá số khác, bắt đầu lại lịch sử
  year = 1991;
  reply = 'Mới';
  await run('Hỏi lại');
  assert.equal(turns.length, 1);
  assert.deepEqual(requests[3].history, []);

  // Hợp bàn lại từ đầu → xóa lượt cũ
  await run('Thêm');
  assert.equal(turns.length, 2);
  await run();
  assert.equal(turns.length, 1);
  assert.equal(turns[0].question, null);

  console.log('Heming history regression passed');
}
main().catch(error => { console.error(error); process.exit(1); });
