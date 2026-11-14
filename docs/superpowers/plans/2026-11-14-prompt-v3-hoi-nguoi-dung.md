# Prompt v3 (hỏi lại + khung 3 tháng) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm prompt v3 cho chat `/chart`: AI gọi tool `hoi_nguoi_dung` để hỏi lại TRƯỚC khi luận (thẻ câu hỏi kiểu AskUserQuestion), và mặc định luận theo khung 3 tháng âm lịch có nút nhảy ◀ ▶.

**Architecture:** Tool hỏi lại kết thúc request (stateless): server phát SSE `{"ask":…}`, lưu tin assistant gồm câu dẫn + khối `<!--ask:{json}-->` với `messages.status='asked'`; câu trả lời là lượt mới có cờ `answering`, không trừ lượt nếu DB xác nhận tin cuối là `asked`. Khung 3 tháng truyền qua `timeContext.window`; prompt v3 tính sẵn lưu nguyệt 3 tháng bằng tool `xem_van_han`. Mọi thứ chỉ bật khi version đang chạy là v3.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, iztro, test bằng `tsx` script + `node:assert` (đăng ký trong `package.json` `scripts.test`).

**Spec:** `docs/superpowers/specs/2026-11-14-prompt-v3-hoi-nguoi-dung-design.md`

## Global Constraints

- v1/v2: prompt, tool list và hành vi **không đổi**.
- `hoi_nguoi_dung`: 1–3 câu; mỗi câu 2–4 lựa chọn; `nhan` ≤ 12 ký tự; "Tự nhập" không khai báo, UI luôn thêm.
- Hỏi liên tiếp tối đa **2** lần; lần thứ 3 không gửi tool `hoi_nguoi_dung`.
- Model đã phát > **200** ký tự (`PREAMBLE_HOLD_CHARS`) rồi mới gọi `hoi_nguoi_dung` → bỏ tool call đó, lượt là câu trả lời thường.
- Khung = 3 tháng âm lịch (không tính tháng nhuận, đúng như tool `xem_van_han`), mặc định bắt đầu ở tháng âm hiện tại giờ VN, nhảy ±3 tháng, không lùi trước khung mặc định.
- Câu mở mục tự động (hiddenQuestion) không được hỏi lại; mục `personality` không theo khung 3 tháng.
- Trả lời thẻ / "Bỏ qua, cứ luận đi" không trừ lượt; ◀ ▶ trừ lượt.
- Mọi file test mới phải thêm vào `scripts.test` (harness kiểm tra đăng ký).
- Không commit trừ khi người dùng yêu cầu (quy tắc phiên làm việc).
- Không dùng dữ liệu ngày sinh thật trong test.

## Review Focus

- Model trả JSON `hoi_nguoi_dung` hỏng/thiếu trường → không sập, model được báo lỗi và luận tiếp (test ở Task 2).
- Client giả `answering: true` khi tin cuối không phải `asked` → vẫn trừ lượt (test ở Task 5).
- Store tắt (không có DATABASE_URL) → `answering` vẫn trừ lượt bình thường, chat không lỗi (test ở Task 5).
- Khung vắt qua cuối năm âm (tháng 11 → 11,12,1 năm sau) → nhãn và dữ kiện đúng năm (test ở Task 3).
- Nạp lại lịch sử có tin `asked` đã trả lời → thẻ hiện thu gọn, không hiện lại dạng tương tác (logic `extractAsk` + `isAnswered` test ở Task 1; UI kiểm tay ở Task 7).

---

### Task 1: Lõi hỏi lại (thuần, không I/O)

**Files:**
- Create: `lib/ai/ask-user.ts`
- Test: `scripts/regression/ask-user.test.ts`

**Interfaces:**
- Produces:
  - `ASK_TOOL_NAME = 'hoi_nguoi_dung'`
  - `interface AskOption { tieu_de: string; giai_thich?: string }`
  - `interface AskQuestion { nhan: string; noi_dung: string; lua_chon: AskOption[]; chon_nhieu?: boolean }`
  - `interface AskPayload { loi_dan: string; cau_hoi: AskQuestion[] }`
  - `askToolDefinition: { name: string; description: string; parameters: Record<string, unknown> }` (JSON schema theo spec mục 1)
  - `parseAskArgs(raw: string): AskPayload | null` — cắt về giới hạn (≤3 câu, ≤4 lựa chọn, bỏ câu <2 lựa chọn, `nhan` cắt 12, chuỗi cắt 200); không còn câu nào → `null`; `loi_dan` trống → mặc định `'Để luận đúng chuyện của bạn, cho mình hỏi thêm:'`
  - `encodeAsk(p: AskPayload): string` → `` `${p.loi_dan}\n\n<!--ask:${JSON.stringify(p)}-->` ``
  - `extractAsk(content: string): { text: string; ask: AskPayload | null }` (bỏ khối khỏi `text`)
  - `askToPlainText(content: string): string` — khối → `Mình đã hỏi:\n1) <noi_dung> (Lựa chọn: a / b)\n…`; không có khối thì trả nguyên
  - `formatAnswers(ask: AskPayload, answers: Array<string[] | null>): string` → `Trả lời câu hỏi:\n- <nhan>: <đáp án nối bằng ", " hoặc "bỏ qua">`
  - `SKIP_ANSWER = 'Bỏ qua câu hỏi, hãy luận theo dữ kiện hiện có.'`
  - `trailingAsks(messages: { role: string; content: string }[]): number` — số tin assistant chứa khối ask liên tiếp tính từ cuối, bỏ qua tin user xen giữa; dừng ở tin assistant không có khối
  - `MAX_CONSECUTIVE_ASKS = 2`

- [ ] **Step 1: Viết test thất bại** `ask-user.test.ts` gồm các assert:
  - `parseAskArgs('{bad')` → `null`; `parseAskArgs(JSON.stringify({cau_hoi:[]}))` → `null`
  - 5 câu, câu đầu 6 lựa chọn, `nhan:'Một nhãn rất là dài'` → còn 3 câu, câu đầu 4 lựa chọn, `nhan.length <= 12`
  - câu chỉ 1 lựa chọn bị bỏ
  - `extractAsk(encodeAsk(p))` → `{ text: p.loi_dan, ask: p }` (deepEqual)
  - `askToPlainText(encodeAsk(p))` không chứa `<!--ask:` và chứa `noi_dung` của câu 1
  - `formatAnswers(p, [['Đã kết hôn'], null])` === `'Trả lời câu hỏi:\n- Hôn nhân: Đã kết hôn\n- Con cái: bỏ qua'`
  - `trailingAsks([{u},{a:ask},{u},{a:ask}])` === 2; `trailingAsks([{a:ask},{u},{a:'bài luận'},{u}])` === 0
- [ ] **Step 2:** Thêm `tsx scripts/regression/ask-user.test.ts` vào `scripts.test`; chạy `npx tsx scripts/regression/ask-user.test.ts` → FAIL (module chưa có).
- [ ] **Step 3:** Viết `lib/ai/ask-user.ts` theo Interfaces.
- [ ] **Step 4:** Chạy lại → PASS.

### Task 2: Vòng agent hỗ trợ hỏi lại

**Files:**
- Modify: `lib/ai/chat-stream.ts` (`StreamOptions`, vòng lặp trong `start`, `openUpstream` nhận thêm tool def)
- Modify: `lib/store/chat-store.ts` (`TurnResult` thêm `asked?: boolean`)
- Test: `scripts/regression/ask-agent-loop.test.ts`

**Interfaces:**
- Consumes: Task 1 `askToolDefinition`, `parseAskArgs`, `encodeAsk`, `ASK_TOOL_NAME`
- Produces: `StreamOptions.askUser?: boolean`; SSE `data: {"ask": AskPayload}`; `TurnResult.asked = true` và `TurnResult.text = encodeAsk(payload)` khi hỏi.

- [ ] **Step 1: Test thất bại** (cùng kiểu fake fetch như `ai-agent-loop.test.ts`):
  - `askUser:true`, model gửi chữ "Bài luận dài…" (<200 ký tự) + tool call `hoi_nguoi_dung` hợp lệ → events có đúng một `ask`, không có `delta` nào; fetch chỉ gọi 1 lần; `onFinish` nhận `asked:true`, `text` chứa `<!--ask:`
  - body gửi lên có tool tên `hoi_nguoi_dung` khi `askUser:true`; không có khi không bật
  - args hỏng → model nhận tool message lỗi, vòng 2 trả "OK" → text "OK", không có `ask`
  - model phát 300 ký tự rồi mới gọi `hoi_nguoi_dung` → không có `ask`, text là 300 ký tự đó, `asked` không set
  - cùng vòng có `xem_van_han` + `hoi_nguoi_dung` → tool `xem_van_han` không chạy, có `ask`
- [ ] **Step 2:** Đăng ký test; chạy → FAIL.
- [ ] **Step 3:** Sửa `chat-stream.ts`: khi `askUser` thì thêm `askToolDefinition` vào danh sách tool gửi đi (vòng cuối không gửi tool nào như cũ). Trong vòng có call `hoi_nguoi_dung`: nếu đã `flushing` (đã phát >200 ký tự) → bỏ call đó, coi như không có call này; nếu `parseAskArgs` null → đẩy tool message `{"lỗi":"Tham số câu hỏi không hợp lệ, hãy luận luôn."}` và chạy tiếp như tool thường; hợp lệ → `answer = encodeAsk(p)`, `send({ask:p})`, `finish('ok')` với `asked:true`, thoát vòng. Lời dạo đầu đang giữ (`held`) bị bỏ.
- [ ] **Step 4:** Chạy test mới + `ai-agent-loop.test.ts` + `chat-stream-finish.test.ts` → PASS.

### Task 3: Khung 3 tháng (thuần)

**Files:**
- Create: `lib/ziwei/month-window.ts`
- Test: `scripts/regression/month-window.test.ts`

**Interfaces:**
- Produces:
  - `interface MonthWindow { lunarYear: number; startMonth: number }`
  - `defaultWindow(now?: Date): MonthWindow` — tháng âm hiện tại giờ VN (`solarToLunarVN`, tz 7); tháng nhuận → dùng số tháng của nó
  - `shiftWindow(w: MonthWindow, steps: number): MonthWindow` — dời `steps*3` tháng, qua năm đúng
  - `windowMonths(w): Array<{ lunarYear: number; month: number }>` — 3 phần tử
  - `isBeforeDefault(w, now?: Date): boolean`
  - `windowLabel(w): { months: string; solar: string }` → `{ months: 'Tháng 10 – 12 âm', solar: 'dd/mm/yyyy – dd/mm/yyyy' }` lấy từ `lunarMonthsVN` (bỏ tháng nhuận; vắt năm thì ghi `'Tháng 11/2026 – 1/2027 âm'`)
  - `parseWindow(v: unknown): MonthWindow | undefined` — validate input client (năm 1900–2100, tháng 1–12)

- [ ] **Step 1: Test thất bại:** `shiftWindow({2026,11},1)` → `{2027,2}`; `windowMonths({2026,11})` → `[{2026,11},{2026,12},{2027,1}]`; `shiftWindow({2027,1},-1)` → `{2026,10}`; `parseWindow({lunarYear:2026,startMonth:13})` → `undefined`; `windowLabel({2026,10}).solar` khớp `/^\d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4}$/` và ngày đầu = `start` của tháng 10 trong `lunarMonthsVN(2026)`; `defaultWindow(new Date('2026-11-14T05:00:00Z'))` → `startMonth` = tháng âm của ngày đó theo `solarToLunarVN(14,11,2026,7)`.
- [ ] **Step 2:** Đăng ký; chạy → FAIL.
- [ ] **Step 3:** Viết module.
- [ ] **Step 4:** PASS.

### Task 4: Prompt v3

**Files:**
- Modify: `lib/prompts/shared.ts` (`InterpretationStyle` thêm trường tùy chọn; `InterpretationTimeContext.window?: MonthWindow`; `buildInterpretationPrompt` dùng các trường đó)
- Create: `lib/prompts/v3/index.ts`
- Modify: `lib/prompts/index.ts` (`PromptVersionId` thêm `'v3'`, `PROMPT_VERSIONS`, `SETS`)
- Test: `scripts/regression/prompt-versions.test.ts` (mở rộng)

**Interfaces:**
- Consumes: Task 3 `MonthWindow`, `defaultWindow`, `windowMonths`, `windowLabel`; `buildChartTools` (`xem_van_han`) để tính sẵn lưu nguyệt
- Produces:
  - `InterpretationStyle.askRule?: string` (thay dòng "Không dùng các lời khuyên mẫu… Hỏi lại tối đa một câu…" khi có)
  - `InterpretationStyle.timeRules?: string` (thay khối "Cách luận vận hạn cho sâu" khi có)
  - `InterpretationStyle.windowFacts?: (chart, time) => unknown` (có thì thêm khối `Dữ kiện lưu nguyệt khung 3 tháng (JSON):`)
  - `promptSetV3: PromptSet`; nhãn `'v3 – hỏi lại trước, luận 3 tháng tới'`

- [ ] **Step 1: Test thất bại** (thêm vào `prompt-versions.test.ts`):
  - `PROMPT_VERSIONS.map(v=>v.id)` deepEqual `['v1','v2','v3']`
  - p3 (career, `{window:{lunarYear:2026,startMonth:10}}`) chứa `'hoi_nguoi_dung'`, `'Dữ kiện lưu nguyệt khung 3 tháng (JSON):'`, `'tháng 10'`; không chứa `'Hỏi lại tối đa một câu'`
  - p1, p2 vẫn chứa `'Hỏi lại tối đa một câu'` và `'Cách luận vận hạn cho sâu'`, không chứa `'hoi_nguoi_dung'`
  - `v3.initialInterpretationQuestion({type:'topic',key:'career'})` chứa `'3 tháng'`; với `key:'personality'` không chứa `'3 tháng'`
  - p3 cho intent personality không chứa khối lưu nguyệt
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Viết các thay đổi. Nội dung luật v3 lấy nguyên ý từ spec mục 3 (luật hỏi lại, luật thời gian, câu mở mục). `windowFacts` gọi `xem_van_han.run({nam, thang})` cho 3 tháng của `time.window ?? defaultWindow()`, chỉ giữ `{tháng_âm, năm_âm_lịch, lưu_nguyệt, hóa_chồng_tầng}` để prompt gọn.
- [ ] **Step 4:** Chạy `prompt-versions.test.ts` + `ai-prompt-tools-match.test.ts` → PASS.

### Task 5: Store + route `/api/interpret` + `/api/account`

**Files:**
- Modify: `lib/store/chat-store.ts` (`ChatStore.lastAssistantStatus`)
- Modify: `lib/store/memory-chat-store.ts`, `lib/store/neon-chat-store.ts` (`recordTurnEnd` ghi `status = r.asked ? 'asked' : r.status` cho tin message; ai_requests giữ `r.status`; cài `lastAssistantStatus`)
- Modify: `app/api/interpret/route.ts`
- Modify: `app/api/account/route.ts` (thêm `promptVersion`)
- Test: `scripts/regression/interpret-ask-route.test.ts`

**Interfaces:**
- Consumes: Task 1 `askToPlainText`, `trailingAsks`, `MAX_CONSECUTIVE_ASKS`; Task 2 `askUser`; Task 3 `parseWindow`
- Produces:
  - `ChatStore.lastAssistantStatus(q: HistoryQuery & { threadKey: string }): Promise<string | null>` (tin assistant cuối sau mốc reset)
  - Body `/api/interpret` nhận `answering?: boolean`, `timeContext.window?`
  - Response header `X-Prompt-Version`; `/api/account` trả thêm `promptVersion`

- [ ] **Step 1: Test thất bại** (memory store + `setChatStoreForTest`, cookie env như `chat-persistence.test.ts`; active version đặt `v3` qua `setSetting(ACTIVE_PROMPT_KEY,'v3')`):
  - v3: body gửi model có tool `hoi_nguoi_dung`; v2: không có
  - lịch sử client có 2 tin ask liên tiếp → v3 không gửi `hoi_nguoi_dung`
  - tin assistant chứa khối ask trong lịch sử → nội dung gửi model không chứa `<!--ask:`
  - header `X-Prompt-Version` = `'v3'`
  - model hỏi lại (fake tool call) → sau `flush`, `lastAssistantStatus` = `'asked'`
  - tài khoản member (dùng user store giả như `user-accounts.test.ts`): `answering:true` sau tin `asked` → `chatUsed` không tăng; `answering:true` khi tin cuối `ok` → tăng 1
  - store tắt: `answering:true` → vẫn trừ, status 200
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Route: version v3 → `askUser = trailingAsks(messages) < MAX_CONSECUTIVE_ASKS && !hiddenQuestion`; map tin assistant qua `askToPlainText` trước khi gửi; `window = parseWindow(timeContext.window)`; nếu `answering === true` và store bật và `lastAssistantStatus(...) === 'asked'` → bỏ qua `chargeChat` (quota header lấy từ `/api/account` phía client như cũ, không set); set header `X-Prompt-Version`.
- [ ] **Step 4:** Chạy test mới + `chat-persistence.test.ts` + `chat-history.test.ts` + `neon-store.test.ts` + `chat-store-memory.test.ts` → PASS.

### Task 6: Gợi ý câu hỏi tĩnh (thuần)

**Files:**
- Create: `lib/chat/suggestions.ts`
- Test: `scripts/regression/suggestions.test.ts`

**Interfaces:**
- Produces: `suggestionsFor(threadKey: string, w: MonthWindow): string[]` — 2–3 câu theo chủ đề (`love`, `career`, `wealth`, `health`, `overview`, `palace:*`, khác) có chèn tên tháng giữa khung, ví dụ career + `{2026,10}` → chứa `'tháng 11 âm'`; `personality` → `[]`.

- [ ] **Step 1:** Test: career → độ dài 2–3, có phần tử chứa `'tháng 11 âm'`; personality → `[]`.
- [ ] **Step 2:** Đăng ký; FAIL. **Step 3:** Viết. **Step 4:** PASS.

### Task 7: UI — thẻ hỏi lại, thanh khung 3 tháng, gợi ý (InsightPanel)

**Files:**
- Create: `components/AskCard.tsx`
- Modify: `components/InsightPanel.tsx`

**Interfaces:**
- Consumes: Task 1 (`extractAsk`, `formatAnswers`, `SKIP_ANSWER`, `AskPayload`), Task 3 (`defaultWindow`, `shiftWindow`, `windowLabel`, `isBeforeDefault`), Task 5 (`promptVersion` từ `/api/account`, SSE `ask`, body `answering`, `timeContext.window`), Task 6.
- `AskCard` props: `{ ask: AskPayload; answered?: string; onSubmit(text: string): void; onSkip(): void; disabled?: boolean }`

- [ ] **Step 1:** `AskCard` đúng spec mục 5: tab theo `nhan` + tab "Gửi"; mỗi lần một câu; lựa chọn có giải thích; lựa chọn cuối "Tự nhập…" mở ô gõ; `chon_nhieu` = checkbox; phím ↑↓/số/Enter/Tab/←→/Esc; nút "Bỏ qua, cứ luận đi"; `answered` → hiện thu gọn chỉ đọc. Dùng biến màu `var(--t-*)` sẵn có.
- [ ] **Step 2:** InsightPanel: đọc `promptVersion` từ `/api/account`; xử lý event `ask` (tin assistant = `encodeAsk` để giống lịch sử nạp lại); render tin có khối ask bằng `AskCard` (đã có tin user sau nó → `answered` = nội dung tin đó); gửi trả lời bằng `send` kèm `answering:true`; gõ vào khung chat khi đang có thẻ chưa trả lời → gửi thường.
- [ ] **Step 3:** v3: thanh `◀ <months> (<solar>) ▶` mỗi mục (trừ `personality`); state window theo thread, mặc định `defaultWindow()`; ◀ disable khi `isBeforeDefault(shiftWindow(w,-1))`; bấm → dời khung + `send` câu ngầm (hidden) `Luận <nhãn mục> cho <months>.` với `timeContext.window`; dưới câu trả lời cuối hiện nút `suggestionsFor`.
- [ ] **Step 4:** `npm run typecheck` → không lỗi.
- [ ] **Step 5:** Kiểm tay trên trình duyệt (dev server, active version v3 qua `/admin`): (a) mở mục Sự nghiệp → luận 3 tháng, không có thẻ; (b) gõ "Năm nay tình cảm thế nào?" ở mục Tình duyên khi chưa kể gì → thẻ hiện ngay, không có bài luận; (c) trả lời → luận theo câu trả lời, lượt không tăng; (d) ▶ → khung 3 tháng sau; (e) tải lại trang → thẻ hiện thu gọn; (f) đổi về v2 → không có thanh khung, không có thẻ.

### Task 8: Kiểm tra toàn bộ

- [ ] **Step 1:** `npm run harness` (đăng ký test + typecheck + regression + build) → toàn bộ pass.
- [ ] **Step 2:** Rà lại theo `docs/harness/review.md`, báo kết quả lệnh đã chạy và các điểm chưa kiểm được.
