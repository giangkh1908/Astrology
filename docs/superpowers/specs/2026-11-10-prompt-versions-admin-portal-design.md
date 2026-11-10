# Prompt version + Portal quản trị + Lưu hội thoại & log — Thiết kế

Ngày: 2026-11-10 · Trạng thái: đã duyệt thiết kế, chờ duyệt spec

## Mục tiêu

- Chỉ một người dùng (admin duy nhất, đăng nhập bằng tài khoản trong env — đã có `proxy.ts`).
- Có version prompt: bản trước thay đổi gần nhất là **v1**, bản hiện tại là **v2**. Portal bấm chọn version đang chạy, có hiệu lực ngay, không cần deploy.
- Lưu **mỗi lá số** cùng **toàn văn mọi đoạn chat AI** của lá số đó, và **log** mỗi lần hỏi AI, để xem lại và so sánh v1/v2.

Không làm trong đợt này: nhiều tài khoản/phân quyền, sửa prompt trên portal, khôi phục chat từ DB sang máy khác (client vẫn đọc `localStorage`), thống kê/biểu đồ.

## Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Người dùng | 1 admin | Portal để tự xem lại và so prompt |
| Lưu trữ | Neon Postgres (`@neondatabase/serverless`, SQL thuần, không ORM) | Vercel không ghi file lâu dài; Postgres lọc log linh hoạt |
| Version prompt mới | Viết trong code, có test | Prompt là hàm TS ghép dữ liệu lá số; sửa trên web dễ làm hỏng |

## Biến môi trường

| Biến | Bắt buộc | Ví dụ / ghi chú |
|---|---|---|
| `DATABASE_URL` | Có (để lưu/log/portal) | `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` — chuỗi **pooled** của Neon. Thiếu thì chat vẫn chạy nhưng không lưu gì, portal báo "chưa cấu hình DB". |
| `DEFAULT_PROMPT_VERSION` | Không | `v2`. Dùng khi DB chưa có lựa chọn hoặc DB lỗi. Mặc định `v2`. |
| `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET` | Có | Đã có từ trước (đăng nhập). |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Có | Đã có từ trước. |

Cách lấy `DATABASE_URL`: Vercel → Project → Storage → Create → Neon (Marketplace), region Singapore; Vercel tự thêm `DATABASE_URL` vào env của project. Dev local: copy chuỗi đó vào `.env.local` (hoặc `vercel env pull .env.local`). Không cần `DATABASE_URL_UNPOOLED` vì driver HTTP của Neon chạy được cả migrate.

## 1. Prompt version

```
lib/prompts/
  v1/interpretation.ts   ← nội dung astrology-interpretation.ts tại commit af7a4d0
  v1/compatibility.ts    ← compatibility.ts tại commit af7a4d0
  v2/interpretation.ts   ← bản hiện tại
  v2/compatibility.ts
  index.ts               ← registry
```

- `index.ts` xuất `PROMPT_VERSIONS: { id: 'v1' | 'v2'; label: string; description: string; set: PromptSet }[]` và `getPromptSet(id)`.
- `PromptSet` = `{ buildInterpretationSystemPrompt, initialInterpretationQuestion, buildCompatibilitySystemPrompt, DEFAULT_COMPATIBILITY_QUESTION }` — đúng chữ ký hiện tại.
- Phần dùng chung giữa hai bản đặt ở `lib/prompts/shared.ts`: kiểu `InterpretationIntent`/`InterpretationTimeContext`, `chartFacts` (bản hiện tại), `intentGuidance` và các hàm phụ. **v1 dùng `chartFacts` hiện tại** (có dữ kiện sinh đôi, vốn thêm sau commit af7a4d0 và không thuộc thay đổi cách trình bày); v1 chỉ khác v2 ở các câu chỉ dẫn trình bày trong system prompt và câu hỏi mở đầu (`initialInterpretationQuestion`), và compatibility thiếu dòng "Cách trình bày".
- Import cũ `@/lib/prompts/astrology-interpretation` / `compatibility` được thay ở các chỗ dùng; không giữ file cũ.
- Mỗi request: `resolvePromptVersion()` đọc `settings.active_prompt_version`; DB không có/lỗi/giá trị lạ → `DEFAULT_PROMPT_VERSION` → `v2`. Không cache giữa request (1 truy vấn nhỏ).
- Test `ai-prompt-tools-match` chạy lặp cho mọi version.

## 2. Database

`db/migrations/001_init.sql`, chạy bằng `npm run db:migrate` (script đọc thư mục, ghi bảng `schema_migrations`, chạy file chưa chạy, idempotent).

```sql
settings(key text primary key, value text not null, updated_at timestamptz default now())

charts(
  id uuid primary key default gen_random_uuid(),
  chart_key text unique not null,         -- year-month-day-hour-gender-tz[-twin-method], giống key localStorage
  birth_info jsonb not null,              -- birthInfo của ZiweiChart
  created_at timestamptz default now(),
  last_activity_at timestamptz default now())

conversations(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('interpret','heming')),
  chart_id uuid not null references charts(id),
  partner_chart_id uuid references charts(id),   -- chỉ cho heming
  thread_key text not null,                       -- 'overview', 'palace-3', 'sihua-...', 'heming'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (kind, chart_id, partner_chart_id, thread_key))  -- partner null: dùng unique index với coalesce

messages(
  id bigserial primary key,
  conversation_id uuid not null references conversations(id),
  role text not null check (role in ('user','assistant')),
  content text not null,
  prompt_version text,             -- với assistant
  request_id uuid,                 -- trỏ tới ai_requests
  status text,                     -- assistant: 'ok' | 'error' | 'aborted'
  created_at timestamptz default now())

ai_requests(
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  route text not null,             -- 'interpret' | 'heming'
  prompt_version text not null,
  model text not null,
  question text,                   -- câu hỏi user của lượt này (toàn văn)
  status text not null,            -- 'ok' | 'error' | 'aborted'
  error text,
  first_token_ms int,
  duration_ms int,
  tool_calls jsonb,                -- [{name, arguments}]
  prompt_tokens int, completion_tokens int, cost_usd numeric,   -- từ usage của OpenRouter nếu có
  created_at timestamptz default now())
```

Index: `messages(conversation_id, id)`, `ai_requests(created_at desc)`, `ai_requests(prompt_version)`, `conversations(chart_id)`.

## 3. Luồng ghi

- Port `ChatStore` (`lib/store/chat-store.ts`): `getActivePromptVersion()`, `setActivePromptVersion()`, `recordTurnStart(...)` → `{ conversationId, requestId }`, `recordTurnEnd(requestId, result)`, cùng các hàm đọc cho portal. Adapter `lib/store/neon-chat-store.ts`; `lib/store/memory-chat-store.ts` cho test; `getChatStore()` chọn theo `DATABASE_URL` (thiếu → store rỗng/no-op).
- Client gửi thêm `threadKey` (InsightPanel đã có) trong body `/api/interpret`; `/api/heming` dùng `'heming'`. Server tính `chart_key` từ `birthInfo` (một hàm dùng chung với InsightPanel).
- Route: resolve version → `recordTurnStart` (upsert chart, conversation; insert message user là tin user cuối cùng; insert `ai_requests` trạng thái tạm `pending`) → `streamChatResponse` trả stream như cũ.
- `streamChatResponse` nhận thêm hook `onFinish({ text, status, error, toolCalls, usage, firstTokenMs, durationMs })`: gom chữ đã stream, được gọi đúng một lần khi xong / lỗi / client hủy (`signal` abort). Thêm `usage: { include: true }` vào request OpenRouter để có token và chi phí.
- `onFinish` → `recordTurnEnd`: insert message assistant (cả bản dở khi aborted) và cập nhật `ai_requests`.
- Mọi lỗi DB: `console.error` (không in nội dung chat), không ném ra ngoài, không ảnh hưởng stream. Trên Vercel, ghi sau khi stream đóng dùng `after()` của `next/server` để function không bị dừng trước khi ghi xong.
- Append-only: không có API sửa/xóa.

## 4. Portal `/admin`

Trang server-render (đã nằm sau `proxy.ts`), client component nhỏ cho thao tác. API `/api/admin/*` (proxy đã chặn 401 khi chưa đăng nhập).

- **Prompt** (`/admin`): bảng v1/v2 — mô tả, số lượt đã dùng, lần dùng gần nhất; radio chọn version đang chạy → `POST /api/admin/prompt-version` (chỉ nhận id có trong registry).
- **Lá số** (`/admin/charts`): danh sách (ngày giờ sinh, giới tính, sinh đôi, số luồng chat, lần hỏi cuối), mới nhất trước, phân trang 50. `/admin/charts/[id]`: thông tin sinh + link mở lá số ở `/chart`, mọi luồng chat (Interpret theo thread, Hợp bàn kèm lá số đối phương), hiển thị toàn văn từng tin, nhãn version + trạng thái mỗi câu trả lời.
- **Log** (`/admin/logs`): bảng `ai_requests` mới nhất trước, lọc theo khoảng ngày, route, version, trạng thái; phân trang 50; bấm dòng mở chi tiết (câu hỏi, câu trả lời, tool calls, token/chi phí, lỗi).
- Thanh tab đơn giản, dùng biến màu sẵn có trong `globals.css`; làm việc được ở màn hình điện thoại.
- DB chưa cấu hình → portal hiện hướng dẫn đặt `DATABASE_URL`.

## 5. Kiểm thử

Regression mới (đăng ký vào `npm test`):
- `prompt-versions.test.ts`: registry có v1, v2; v1 chứa câu cũ "cá nhân hóa bằng tên sao/cung cụ thể" và không chứa "KHÔNG nhắc tên sao", v2 ngược lại (cả interpretation lẫn compatibility); resolve version rơi về mặc định khi store lỗi/giá trị lạ.
- `chat-persistence.test.ts` (memory store + fetch giả): stream thành công ghi đủ user/assistant/log và token; upstream lỗi ghi status error; abort giữa chừng ghi phần dở + aborted; store ném lỗi thì client vẫn nhận đủ stream.
- `admin-api.test.ts`: đổi version hợp lệ/không hợp lệ; proxy trả 401 cho `/api/admin/*` khi chưa đăng nhập.
- `ai-prompt-tools-match` chạy cho mọi version.
- Kiểm tra tay: `npm run harness`, chạy với một Neon branch thật: hỏi vài câu, đổi v1/v2, xem portal.

## Rủi ro

- Ghi sau stream trên serverless: dùng `after()`; nếu function bị cắt vì `maxDuration` thì log có thể kẹt `pending` — portal hiển thị đúng trạng thái đó.
- Dữ liệu ngày sinh và hội thoại là dữ liệu cá nhân của chính bạn; chỉ lưu trong Neon của bạn, không in ra log server.
