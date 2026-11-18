-- Số token đầu vào đọc từ cache của nhà cung cấp (OpenRouter usage.prompt_tokens_details.cached_tokens).
alter table ai_requests add column if not exists cached_tokens integer;
