-- Tài khoản tự đăng ký: chờ admin duyệt, mỗi tài khoản có hạn mức câu chat (chat_limit null = không giới hạn).
-- Tài khoản trong biến môi trường (AUTH_USERNAME, ADMIN_USERNAME) không nằm trong bảng này.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  password_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'locked')),
  chat_limit int default 5 check (chat_limit is null or chat_limit >= 0),
  chat_used int not null default 0 check (chat_used >= 0),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  last_login_at timestamptz
);
create index if not exists users_status_idx on users(status, created_at desc);

-- Ai đã hỏi (null: tài khoản trong biến môi trường hoặc dữ liệu cũ).
alter table ai_requests add column if not exists user_id uuid references users(id);
create index if not exists ai_requests_user_idx on ai_requests(user_id) where user_id is not null;
