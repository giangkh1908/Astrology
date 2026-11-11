-- Hội thoại theo từng tài khoản: mở lại lá số ở máy nào cũng nạp lại các mục đã luận của chính người đó.
-- user_id null = tài khoản trong biến môi trường (và dữ liệu cũ trước khi có tài khoản).
-- reset_at: mốc "luận lại" / "đóng mục" — tin nhắn trước mốc này không nạp lại cho người dùng (vẫn giữ cho admin).
-- messages.hidden: câu hỏi tự động (mở mục, hợp bàn tổng quan) — không hiện thành bong bóng của người dùng.
-- messages.request_id cho tin user (trước đây chỉ tin trả lời có) để ghép đúng câu hỏi với câu trả lời.

alter table conversations add column if not exists user_id uuid references users(id);
alter table conversations add column if not exists reset_at timestamptz;
alter table conversations drop constraint if exists conversations_identity;
alter table conversations add constraint conversations_identity unique nulls not distinct (kind, chart_id, partner_chart_id, thread_key, user_id);
create index if not exists conversations_owner_idx on conversations(user_id, kind, chart_id);

alter table messages add column if not exists hidden boolean not null default false;
