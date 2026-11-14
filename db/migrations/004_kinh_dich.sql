-- Kinh Dịch: mỗi lần gieo là một hội thoại kind 'kinhdich', không gắn lá số (chart_id null).
-- meta: {"question": "...", "lines": [6..9 ×6] | null, "castAt": "ISO" | null} — lines chỉ ghi một lần.
-- Tin nhắn và log AI dùng chung bảng messages / ai_requests (route 'kinh-dich').

alter table conversations drop constraint if exists conversations_kind_check;
alter table conversations add constraint conversations_kind_check check (kind in ('interpret', 'heming', 'kinhdich'));
alter table conversations alter column chart_id drop not null;
alter table conversations drop constraint if exists conversations_chart_by_kind;
alter table conversations add constraint conversations_chart_by_kind check ((kind = 'kinhdich') = (chart_id is null));
alter table conversations add column if not exists meta jsonb;
create index if not exists conversations_kinhdich_owner_idx on conversations(user_id, created_at desc) where kind = 'kinhdich';
