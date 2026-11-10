-- Lá số, hội thoại AI (toàn văn), log mỗi lần hỏi AI, cài đặt (version prompt đang chạy).
-- Append-only: ứng dụng không sửa/xóa messages và ai_requests (chỉ cập nhật ai_requests khi lượt kết thúc).

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists charts (
  id uuid primary key default gen_random_uuid(),
  chart_key text not null unique,
  birth_info jsonb not null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('interpret', 'heming')),
  chart_id uuid not null references charts(id),
  partner_chart_id uuid references charts(id),
  thread_key text not null check (length(thread_key) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_identity unique nulls not distinct (kind, chart_id, partner_chart_id, thread_key)
);
create index if not exists conversations_partner_idx on conversations(partner_chart_id) where partner_chart_id is not null;

create table if not exists ai_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  route text not null,
  prompt_version text not null,
  model text not null,
  question text,
  status text not null check (status in ('pending', 'ok', 'error', 'aborted')),
  error text,
  first_token_ms int,
  duration_ms int,
  tool_calls jsonb not null default '[]'::jsonb,
  prompt_tokens int,
  completion_tokens int,
  cost_usd numeric,
  created_at timestamptz not null default now()
);
create index if not exists ai_requests_created_idx on ai_requests(created_at desc);
create index if not exists ai_requests_version_idx on ai_requests(prompt_version);
create index if not exists ai_requests_conversation_idx on ai_requests(conversation_id);

create table if not exists messages (
  id bigserial primary key,
  conversation_id uuid not null references conversations(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  prompt_version text,
  request_id uuid references ai_requests(id),
  status text,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on messages(conversation_id, id);
create index if not exists messages_request_idx on messages(request_id) where request_id is not null;
