/**
 * Đọc luồng SSE nội bộ của /api/kinh-dich (định dạng của streamChatResponse):
 * `data: {"delta":{"text":...}}`, `{"status":...}`, `{"ask":{...}}`, `{"error":...}`, dừng ở `data: [DONE]`.
 * Dòng hỏng / comment bị bỏ qua. Dùng được cả ở trình duyệt lẫn test.
 */
export interface SseHandlers {
  delta?: (text: string) => void;
  ask?: (payload: unknown) => void;
  status?: (text: string) => void;
  error?: (message: string) => void;
}

export async function readSse(body: ReadableStream<Uint8Array>, on: SseHandlers): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        let event: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(data);
          if (typeof parsed !== 'object' || parsed === null) continue;
          event = parsed as Record<string, unknown>;
        } catch {
          continue;
        }
        const delta = event.delta as { text?: unknown } | undefined;
        if (delta && typeof delta.text === 'string') on.delta?.(delta.text);
        if (typeof event.status === 'string') on.status?.(event.status);
        if (event.ask !== undefined) on.ask?.(event.ask);
        if (typeof event.error === 'string') on.error?.(event.error);
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}
