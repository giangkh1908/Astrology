# Prompt version + Portal quản trị + Lưu hội thoại Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chọn version prompt (v1/v2) từ portal `/admin`, lưu mọi lá số + toàn văn hội thoại AI + log mỗi lần hỏi vào Neon Postgres.

**Architecture:** Prompt tách thành `lib/prompts/{shared,v1,v2,index}`. Lưu trữ qua port `ChatStore` (adapter Neon, adapter bộ nhớ cho test, no-op khi thiếu `DATABASE_URL`). Route AI resolve version → ghi lượt bắt đầu → stream như cũ; `streamChatResponse` báo kết quả qua `onFinish`, route ghi kết quả bằng `after()`. Portal là trang server-render dưới `/admin`, đã được `proxy.ts` bảo vệ.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`, `after`), TypeScript, `@neondatabase/serverless` 1.x (SQL thuần), test bằng `tsx` + `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-10-prompt-versions-admin-portal-design.md`

## Global Constraints

- Chạy từ `ziwei-doushu/`, Node 22+. Mọi test mới đặt ở `scripts/regression/*.test.ts` và phải thêm vào chuỗi `npm test` trong `package.json` (harness kiểm tra đăng ký).
- Env: `DATABASE_URL` (pooled Neon); `DEFAULT_PROMPT_VERSION` (mặc định `v2`). Thiếu `DATABASE_URL` → chat chạy bình thường, không lưu; portal hiện hướng dẫn.
- Lỗi DB không bao giờ làm hỏng câu trả lời AI; chỉ `console.error` thông điệp lỗi, không in nội dung chat/ngày sinh.
- Append-only: không có API sửa/xóa hội thoại/log.
- Không đổi định dạng SSE nội bộ (`delta.text`, `status`, `error`, `[DONE]`).
- Tên hàm/kiểu trung tính, không mang tên nhà cung cấp ngoài file adapter (`neon-chat-store.ts`) — theo AGENTS.md.
- Không commit trừ khi người dùng yêu cầu; mỗi task kết thúc bằng checkpoint `npm run harness:quick`.
- UI tiếng Việt, dùng biến màu trong `app/globals.css`, chạy được ở bề rộng 360px.

## Review Focus

1. Người dùng bấm "dừng" giữa câu trả lời → phần chữ đã nhận vẫn được lưu, status `aborted`, không treo `pending`. (Task 4 test abort.)
2. DB chậm/lỗi khi bắt đầu lượt → câu trả lời vẫn stream đủ; không có log nhưng không lỗi 500. (Task 5 test store ném lỗi.)
3. Giá trị `active_prompt_version` lạ trong DB (ví dụ `v9` sau khi xóa version) → dùng mặc định, portal vẫn mở được. (Task 2 test.)
4. Hỏi lại cùng thread nhiều lần / client gửi lại toàn bộ lịch sử → chỉ tin user **cuối** được ghi mỗi lượt, không nhân bản lịch sử. (Task 5 test.)
5. Hợp bàn với cùng cặp lá số nhiều lần → dùng chung một conversation (unique theo kind + 2 chart + thread). (Task 3 SQL + Task 5 test với memory store.)

---

### Task 1: Tách prompt thành v1 / v2

**Files:**
- Create: `lib/prompts/shared.ts`, `lib/prompts/v1/interpretation.ts`, `lib/prompts/v1/compatibility.ts`, `lib/prompts/v2/interpretation.ts`, `lib/prompts/v2/compatibility.ts`, `lib/prompts/index.ts`
- Delete: `lib/prompts/astrology-interpretation.ts`, `lib/prompts/compatibility.ts`
- Modify imports: `app/api/interpret/route.ts`, `app/api/heming/route.ts`, `scripts/regression/ai-prompt-tools-match.test.ts`, `scripts/regression/twin-chart.test.ts`
- Test: `scripts/regression/prompt-versions.test.ts`

**Interfaces:**
- Produces:
  - `shared.ts`: `export type InterpretationIntent`, `export interface InterpretationTimeContext`, `export function chartFacts(chart, time)` (bản hiện tại, có `lá_số_sinh_đôi`), và mọi hàm phụ không đổi giữa hai bản (`intentGuidance`, `viBranch`…).
  - `export type PromptVersionId = 'v1' | 'v2'`
  - `export interface PromptSet { buildInterpretationSystemPrompt(chart: ZiweiChart, intent: InterpretationIntent, time: InterpretationTimeContext): string; initialInterpretationQuestion(intent: InterpretationIntent): string; buildCompatibilitySystemPrompt(a: ZiweiChart, b: ZiweiChart): string; defaultCompatibilityQuestion: string }`
  - `export const PROMPT_VERSIONS: readonly { id: PromptVersionId; label: string; description: string }[]` — v1 label "v1 – nêu tên sao làm căn cứ", v2 label "v2 – nói theo cung, kết luận chi tiết".
  - `export function isPromptVersionId(v: unknown): v is PromptVersionId`
  - `export function getPromptSet(id: PromptVersionId): PromptSet`
  - `export function defaultPromptVersion(env = process.env): PromptVersionId` — `DEFAULT_PROMPT_VERSION` nếu hợp lệ, không thì `'v2'`.

- [ ] **Step 1: Viết test `prompt-versions.test.ts`**
  - Sinh chart mẫu `generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male' } as never)`.
  - `PROMPT_VERSIONS.map(v => v.id)` deepEqual `['v1','v2']`.
  - v1 system prompt `includes('cá nhân hóa bằng tên sao/cung cụ thể')` và không `includes('KHÔNG nhắc tên sao')`; v2 ngược lại.
  - v1 `initialInterpretationQuestion({type:'topic',key:'career'})` chứa `'nêu cấu hình cung và sao cụ thể làm căn cứ'`; v2 chứa `'tam phương tứ chính cung Quan Lộc'`.
  - v1 compatibility không chứa `'Cách trình bày: KHÔNG nhắc tên sao'`; v2 chứa.
  - Chart sinh đôi (`twinMethod: 'huynh_de'`): cả v1 và v2 system prompt đều chứa `'lá_số_sinh_đôi'`.
  - `defaultPromptVersion({})==='v2'`, `defaultPromptVersion({DEFAULT_PROMPT_VERSION:'v1'})==='v1'`, `defaultPromptVersion({DEFAULT_PROMPT_VERSION:'v9'})==='v2'`.
  - Đăng ký vào `npm test`.
- [ ] **Step 2: Chạy `npx tsx scripts/regression/prompt-versions.test.ts`** → FAIL (module chưa có).
- [ ] **Step 3: Tạo file.** v2 = nội dung hiện tại. v1 = cùng file, thay các câu đã đổi bằng bản ở `git show af7a4d0:lib/prompts/astrology-interpretation.ts` và `git show af7a4d0:lib/prompts/compatibility.ts` (chỉ khác ở các dòng trong `git diff af7a4d0 -- lib/prompts` thuộc phần trình bày; dòng `lá_số_sinh_đôi` thuộc `chartFacts` nên nằm trong shared). Sửa import ở 4 file dùng; test cũ dùng `getPromptSet('v2')`, và `ai-prompt-tools-match` lặp `for (const { id } of PROMPT_VERSIONS)`.
- [ ] **Step 4: Chạy test mới + `npm run harness:quick`** → PASS.

### Task 2: Port `ChatStore`, store bộ nhớ, chart key, resolve version

**Files:**
- Create: `lib/store/chat-store.ts`, `lib/store/memory-chat-store.ts`, `lib/store/index.ts`, `lib/ziwei/chart-key.ts`
- Modify: `components/InsightPanel.tsx` (`storageKeyOf` dùng `chartKey`)
- Test: `scripts/regression/chat-store-memory.test.ts`

**Interfaces:**
- Consumes: `PromptVersionId`, `isPromptVersionId`, `defaultPromptVersion` (Task 1).
- Produces (`chat-store.ts`):
  ```ts
  export type TurnStatus = 'pending' | 'ok' | 'error' | 'aborted';
  export interface ToolCallLog { name: string; arguments: string }
  export interface TurnStart {
    kind: 'interpret' | 'heming';
    chart: { key: string; birthInfo: unknown };
    partnerChart?: { key: string; birthInfo: unknown };
    threadKey: string;
    question: string;           // tin user cuối của lượt
    promptVersion: PromptVersionId;
    model: string;
  }
  export interface TurnResult {
    text: string; status: Exclude<TurnStatus, 'pending'>; error?: string;
    toolCalls: ToolCallLog[]; firstTokenMs?: number; durationMs: number;
    usage?: { promptTokens?: number; completionTokens?: number; costUsd?: number };
  }
  export interface ChartSummary { id: string; key: string; birthInfo: unknown; createdAt: string; lastActivityAt: string; conversationCount: number }
  export interface StoredMessage { id: string; role: 'user' | 'assistant'; content: string; promptVersion: string | null; status: string | null; createdAt: string }
  export interface ConversationDetail { id: string; kind: 'interpret' | 'heming'; threadKey: string; partner?: { id: string; birthInfo: unknown }; messages: StoredMessage[] }
  export interface RequestLog { id: string; createdAt: string; route: string; promptVersion: string; model: string; status: TurnStatus; question: string | null; answer: string | null; error: string | null; firstTokenMs: number | null; durationMs: number | null; toolCalls: ToolCallLog[]; promptTokens: number | null; completionTokens: number | null; costUsd: number | null; chartId: string | null }
  export interface LogFilter { from?: string; to?: string; route?: string; promptVersion?: string; status?: string; page?: number }   // page 0-based, 50/trang
  export interface VersionUsage { promptVersion: string; count: number; lastUsedAt: string | null }
  export interface ChatStore {
    readonly enabled: boolean;
    getSetting(key: string): Promise<string | null>;
    setSetting(key: string, value: string): Promise<void>;
    recordTurnStart(t: TurnStart): Promise<{ requestId: string }>;
    recordTurnEnd(requestId: string, r: TurnResult): Promise<void>;
    listCharts(page: number): Promise<ChartSummary[]>;
    getChart(id: string): Promise<{ chart: ChartSummary; conversations: ConversationDetail[] } | null>;
    listRequests(f: LogFilter): Promise<RequestLog[]>;
    versionUsage(): Promise<VersionUsage[]>;
  }
  export const ACTIVE_PROMPT_KEY = 'active_prompt_version';
  export async function resolvePromptVersion(store: ChatStore, env = process.env): Promise<PromptVersionId>  // lỗi/lạ → defaultPromptVersion(env)
  ```
- `memory-chat-store.ts`: `export function createMemoryChatStore(): ChatStore` (enabled true; conversation unique theo `kind|chart.key|partner?.key|threadKey`; recordTurnStart chèn tin user + log `pending`; recordTurnEnd chèn tin assistant và cập nhật log).
- `index.ts`: `export function getChatStore(): ChatStore` — singleton; `DATABASE_URL` có → Neon store (Task 3), không → `disabledChatStore` (enabled false, đọc trả rỗng/null, ghi no-op, `recordTurnStart` trả `{requestId:''}`). `export function setChatStoreForTest(s: ChatStore | null)`.
- `chart-key.ts`: `export function chartKey(b: BirthInfo): string` → `${year}-${month}-${day}-${hour}-${gender}-${lunarTimeZone ?? 8}${twinMethod ? `-twin-${twinMethod}` : ''}` (đúng phần sau `ziwei-chat:v1:` của key hiện tại, để localStorage cũ không đổi).

- [ ] **Step 1: Test `chat-store-memory.test.ts`**: hai lượt cùng thread → `getChart` có 1 conversation, 4 messages theo thứ tự user/assistant/user/assistant với `promptVersion` gắn ở assistant; heming cùng cặp 2 lần → 1 conversation; `resolvePromptVersion` trả `'v1'` sau `setSetting(ACTIVE_PROMPT_KEY,'v1')`, trả `'v2'` khi setting = `'v9'`, trả `'v2'` khi `getSetting` ném lỗi; `listRequests({status:'ok'})` lọc đúng; `versionUsage()` đếm theo version; `chartKey` của chart sinh đôi kết thúc bằng `-twin-huynh_de`.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt** các file trên; `InsightPanel.storageKeyOf` = `` `ziwei-chat:${STORE_VERSION}:${chartKey(chart.birthInfo)}` ``.
- [ ] **Step 4: Chạy test + `npm run harness:quick`** → PASS.

### Task 3: Adapter Neon + migration

**Files:**
- Create: `db/migrations/001_init.sql`, `scripts/db/migrate.mjs`, `lib/store/neon-chat-store.ts`
- Modify: `package.json` (dependency `@neondatabase/serverless@^1.2.0`, script `"db:migrate": "node --env-file-if-exists=.env.local scripts/db/migrate.mjs"`), `.env.example` (khối `DATABASE_URL`, `DEFAULT_PROMPT_VERSION` như spec), `lib/store/index.ts` (gắn Neon store).
- Test: `scripts/regression/neon-store.test.ts` (tự bỏ qua, in `skip`, khi không có `TEST_DATABASE_URL`)

**Interfaces:**
- Consumes: `ChatStore` và các kiểu từ Task 2.
- Produces: `export function createNeonChatStore(databaseUrl: string): ChatStore`.

- [ ] **Step 1: `001_init.sql`** đúng schema trong spec mục 2, thêm: `create extension if not exists pgcrypto;` (cho `gen_random_uuid` nếu cần), unique index conversation `create unique index conversations_uniq on conversations(kind, chart_id, coalesce(partner_chart_id,'00000000-0000-0000-0000-000000000000'::uuid), thread_key);`, cột `ai_requests.answer` không có (câu trả lời đọc từ `messages.request_id`).
- [ ] **Step 2: `migrate.mjs`**: tạo `schema_migrations(name text primary key, applied_at timestamptz default now())`, chạy theo thứ tự tên các file `db/migrations/*.sql` chưa có trong bảng, mỗi file trong một transaction (`sql.transaction` hoặc tách câu theo `;` an toàn — file không chứa hàm PL/pgSQL), in tên file đã chạy. Thiếu `DATABASE_URL` → báo lỗi rõ, exit 1.
- [ ] **Step 3: Test `neon-store.test.ts`** chạy lại đúng các kịch bản của Task 2 trên `createNeonChatStore(TEST_DATABASE_URL)` (dữ liệu giả, key ngẫu nhiên để không đụng dữ liệu thật). Đăng ký vào `npm test`.
- [ ] **Step 4: Cài đặt adapter** bằng tagged template `neon(url)`; upsert chart `on conflict (chart_key) do update set last_activity_at = now() returning id`; upsert conversation theo unique index; `recordTurnStart` = upsert chart(s) → upsert conversation → insert message user → insert `ai_requests` status `pending` trả `id`; `recordTurnEnd` = insert message assistant (`request_id`, `prompt_version` lấy từ ai_requests, `status`) + update `ai_requests`. `listRequests` join `messages` (assistant theo `request_id`) để có `answer`, và `conversations` để có `chartId`.
- [ ] **Step 5: Kiểm tra**: không có DB → `npx tsx scripts/regression/neon-store.test.ts` in skip, exit 0. Có Neon branch → `TEST_DATABASE_URL=... npm run db:migrate` rồi chạy test → PASS. `npm run harness:quick` → PASS.

### Task 4: `streamChatResponse` báo kết quả (`onFinish`)

**Files:**
- Modify: `lib/ai/chat-stream.ts`
- Test: `scripts/regression/chat-stream-finish.test.ts`

**Interfaces:**
- Consumes: `TurnResult`, `ToolCallLog` (Task 2).
- Produces: `streamChatResponse(messages, signal, tools?, options?: { onFinish?: (r: TurnResult) => void })`. `export function currentModel(): string` (giá trị đang gửi lên nhà cung cấp, dùng cho log).

- [ ] **Step 1: Test** với `globalThis.fetch` giả (mẫu như `heming-route.test.ts`):
  - Thành công 2 chunk + 1 chunk usage (`{"usage":{"prompt_tokens":10,"completion_tokens":5,"cost":0.0001}}`) → `onFinish` gọi đúng 1 lần, `status 'ok'`, `text` = toàn bộ chữ đã phát ra client, `usage.promptTokens 10`, `costUsd 0.0001`, `firstTokenMs` là số.
  - Có tool call vòng 1 → `toolCalls[0].name` đúng tên tool, `arguments` là chuỗi JSON.
  - Upstream trả HTTP 400 trước khi stream → `onFinish({status:'error', text:'', error: 'HTTP 400'})`, response 502 như cũ.
  - Lỗi giữa stream → `status 'error'`, `text` = phần đã phát.
  - Abort (`AbortController.abort()` sau chunk đầu) → `status 'aborted'`, `text` = chunk đầu.
  - `onFinish` ném lỗi → client vẫn nhận `[DONE]`.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt**: thêm `usage: { include: true }` vào body; `readUpstream` trả thêm `usage` khi gặp event có `usage`; cộng dồn usage qua các vòng; gom `toolCalls` (tên + arguments) qua các vòng; `text` = những gì thực sự `emit` (không gồm lời dạo đầu bị bỏ); `finish()` bọc try/catch và chỉ chạy một lần, gọi ở: lỗi mở upstream (trước khi trả 502/499), cuối stream (ok/error), và nhánh abort.
- [ ] **Step 4: Chạy test mới + `npm run harness:quick`** (các test agent loop cũ không đổi) → PASS.

### Task 5: Gắn version + lưu trữ vào route AI

**Files:**
- Create: `lib/store/persist-turn.ts`
- Modify: `app/api/interpret/route.ts`, `app/api/heming/route.ts`, `components/InsightPanel.tsx` (gửi `threadKey: key` trong body)
- Test: `scripts/regression/chat-persistence.test.ts`

**Interfaces:**
- Consumes: Task 1 (`getPromptSet`), Task 2 (`getChatStore`, `setChatStoreForTest`, `resolvePromptVersion`, `chartKey`), Task 4 (`onFinish`, `currentModel`).
- Produces (`persist-turn.ts`):
  ```ts
  export async function beginTurn(store: ChatStore, t: TurnStart): Promise<{ onFinish: (r: TurnResult) => void }>
  ```
  Gọi `recordTurnStart` (lỗi → log, trả onFinish no-op); `onFinish` lên lịch `recordTurnEnd` bằng `after()` từ `next/server`; nếu `after` ném (ngoài request scope, ví dụ test) thì chạy promise trực tiếp. Lỗi ghi → `console.error(message)`.

- [ ] **Step 1: Test** (memory store qua `setChatStoreForTest`, fetch giả):
  - `/api/interpret` với `threadKey:'career'`, 3 tin lịch sử (user/assistant/user) → store có đúng 1 tin user mới (tin cuối) + 1 assistant, log `ok`, `promptVersion 'v2'`.
  - `setSetting(ACTIVE_PROMPT_KEY,'v1')` → system prompt gửi lên fetch chứa `'cá nhân hóa bằng tên sao/cung cụ thể'`; log `promptVersion 'v1'`.
  - Không có `threadKey` → dùng `` `topic-${intent.key}` `` / `` `palace-${branch}` `` / `` `sihua-${view}-${starName}-${siHua}` `` theo intent (giá trị InsightPanel đang dùng), mặc định `'overview'`.
  - `/api/heming` gọi 2 lần cùng cặp → 1 conversation `kind 'heming'`, 4 messages; câu hỏi rỗng → tin user lưu là `defaultCompatibilityQuestion` của version.
  - Store có `recordTurnStart` ném lỗi → response vẫn 200, client đọc đủ chữ và `[DONE]`.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt**: route đọc `version = await resolvePromptVersion(store)`, `set = getPromptSet(version)`, `threadKey` (chuỗi ≤ 100 ký tự, không thì suy từ intent), gọi `beginTurn` rồi `streamChatResponse(..., { onFinish })`. InsightPanel thêm `threadKey: key` vào body.
- [ ] **Step 4: Chạy test + `npm run harness:quick`** → PASS.

### Task 6: API admin

**Files:**
- Create: `app/api/admin/prompt-version/route.ts`
- Test: `scripts/regression/admin-api.test.ts`

**Interfaces:**
- Consumes: `getChatStore`, `ACTIVE_PROMPT_KEY`, `isPromptVersionId`, `resolvePromptVersion`.
- Produces: `GET` → `{ active: PromptVersionId, versions: PROMPT_VERSIONS, usage: VersionUsage[], dbEnabled: boolean }`; `POST {version}` → 200 `{active}`; id không hợp lệ → 400; store disabled → 503 `{error:'Chưa cấu hình DATABASE_URL.'}`.

- [ ] **Step 1: Test**: POST `'v1'` → GET `active 'v1'`; POST `'v9'` → 400; disabled store → 503; `proxy` với `/api/admin/prompt-version` không cookie → 401 (dùng lại cách tạo `NextRequest` trong `auth-session.test.ts`).
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Cài đặt.** **Step 4: Chạy + `npm run harness:quick`** → PASS.

### Task 7: Portal `/admin`

**Files:**
- Create: `app/admin/layout.tsx` (tiêu đề + thanh tab Prompt / Lá số / Log, `export const dynamic = 'force-dynamic'`), `app/admin/page.tsx` (Prompt), `app/admin/PromptPicker.tsx` (client, radio + POST), `app/admin/charts/page.tsx`, `app/admin/charts/[id]/page.tsx`, `app/admin/logs/page.tsx`, `app/admin/logs/LogRow.tsx` (client, mở/đóng chi tiết), `app/admin/format.ts` (định dạng ngày giờ `Asia/Ho_Chi_Minh`, mô tả birthInfo "05/03/1990 · giờ Sửu · Nam · sinh đôi (Huynh Đệ)", tên thread tiếng Việt).
- Test: `scripts/regression/admin-format.test.ts`

**Interfaces:**
- Consumes: `getChatStore()` (đọc trực tiếp trong server component), `PROMPT_VERSIONS`, `resolvePromptVersion`.
- Produces: trang; `format.ts` xuất `formatDateTime(iso: string): string`, `describeBirth(b: unknown): string`, `threadLabel(threadKey: string): string` (`'overview'`→"Tổng quan", `'career'`/`'topic-career'`→"Sự nghiệp", `palace-N`→"Cung <tên>", `'heming'`→"Hợp bàn", lạ → giữ nguyên).

- [ ] **Step 1: Test `admin-format.test.ts`** cho 3 hàm với các ví dụ trên (gồm sinh đôi và birthInfo hỏng → `'(không rõ)'`).
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Cài đặt** `format.ts` rồi các trang:
  - Prompt: thẻ mỗi version (label, mô tả, số lượt, lần dùng cuối), version đang chạy được đánh dấu; `PromptPicker` đổi xong `router.refresh()`.
  - Lá số: bảng/thẻ (mô tả sinh, số luồng chat, hoạt động cuối), phân trang `?page=`, mới nhất trước.
  - Chi tiết lá số: mô tả sinh, link "Mở lá số" tới `/chart` theo cách `lib/ziwei/share.ts` dựng URL, mỗi conversation một khối (nhãn thread, Hợp bàn kèm mô tả lá số đối phương), tin nhắn hiển thị toàn văn (`white-space: pre-wrap`), câu trả lời có nhãn version + status.
  - Log: form GET lọc `from`, `to`, `route`, `version`, `status`; bảng thời gian · lá số · câu hỏi (cắt 80 ký tự) · version · model · thời gian tới chữ đầu/tổng · token/chi phí · status; bấm dòng mở chi tiết (câu hỏi, câu trả lời, tool calls, lỗi); phân trang.
  - `store.enabled === false` → mọi trang hiện khối hướng dẫn đặt `DATABASE_URL` và chạy `npm run db:migrate`.
  - Thêm link "Quản trị" cạnh nút Đăng xuất trong `components/LogoutButton.tsx` (ẩn khi đang ở `/admin`).
- [ ] **Step 4: Chạy test + `npm run harness`** (gồm build) → PASS.

### Task 8: Kiểm tra đầu-cuối với Neon

- [ ] **Step 1:** Đặt `DATABASE_URL` (Neon branch dev) trong `.env.local`, `npm run db:migrate` → in `001_init.sql`.
- [ ] **Step 2:** `npm run build && npx next start -p 3123`; đăng nhập; mở `/chart`, hỏi 2 câu ở một chủ đề, bấm dừng một câu giữa chừng, hỏi 1 câu Hợp bàn.
- [ ] **Step 3:** `/admin`: đổi sang v1, hỏi thêm 1 câu; kiểm tra Lá số có toàn văn 4 lượt kèm nhãn v2/v1 và câu "đã dừng"; Log có đủ dòng, token/chi phí, tool calls; lọc theo version v1 chỉ còn 1 dòng.
- [ ] **Step 4:** Chụp màn hình portal ở bề rộng 375px để kiểm tra không tràn ngang.
- [ ] **Step 5:** Báo kết quả: lệnh đã chạy, kết quả, hạn chế còn lại (ví dụ log kẹt `pending` khi function bị cắt).
