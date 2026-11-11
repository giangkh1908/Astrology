/**
 * Ai đang gọi API và trừ lượt chat. Tài khoản env (AUTH_USERNAME) không giới hạn;
 * tài khoản tự đăng ký trừ 1 câu cho mỗi lần gọi AI, hoàn lại nếu AI lỗi trước khi trả được chữ nào.
 */
import { cookieValue } from '@/lib/auth/guard';
import { readAuthConfig, readSessionSecret, SESSION_COOKIE, verifyMemberToken, verifySessionToken } from '@/lib/auth/session';
import type { TurnResult } from '@/lib/store/chat-store';
import { getUserStore } from './index';
import { consumeErrorMessage, type UserStore } from './user-store';

export type Caller = { kind: 'env'; username: string } | { kind: 'member'; userId: string };

export async function callerOf(request: Request, env: Record<string, string | undefined> = process.env): Promise<Caller | null> {
  const token = cookieValue(request.headers.get('cookie'), SESSION_COOKIE);
  const config = readAuthConfig(env);
  if (config && await verifySessionToken(token, config)) return { kind: 'env', username: config.username };
  const userId = await verifyMemberToken(token, readSessionSecret(env));
  return userId ? { kind: 'member', userId } : null;
}

export interface Quota { used: number; limit: number | null }

/** Giá trị header X-Chat-Quota: "3/5" hoặc "0/unlimited" (header chỉ nên chứa ASCII). */
export function quotaHeader(q: Quota): string {
  return `${q.used}/${q.limit ?? 'unlimited'}`;
}

export type Charge =
  | { ok: true; userId: string | null; quota: Quota; refund: () => Promise<void> }
  | { ok: false; response: Response };

const deny = (error: string, status: number, quota?: Quota) => ({
  ok: false as const,
  response: Response.json({ error }, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(quota ? { 'X-Chat-Quota': quotaHeader(quota) } : {}) },
  }),
});

/** Trừ 1 câu trước khi gọi AI. Lỗi DB → từ chối (không cho chat miễn phí khi không đếm được). */
export async function chargeChat(request: Request, store: UserStore = getUserStore()): Promise<Charge> {
  const caller = await callerOf(request);
  if (!caller) return deny('Chưa đăng nhập.', 401);
  if (caller.kind === 'env') return { ok: true, userId: null, quota: { used: 0, limit: null }, refund: async () => undefined };

  let result;
  try {
    result = await store.consumeChat(caller.userId);
  } catch (error) {
    console.error('consumeChat failed:', error instanceof Error ? error.message : 'unknown error');
    return deny('Không kiểm tra được lượt hỏi, vui lòng thử lại sau.', 503);
  }
  if (!result.ok) {
    const quota = result.reason === 'quota' ? { used: result.used ?? 0, limit: result.limit ?? 0 } : undefined;
    return deny(consumeErrorMessage(result), result.reason === 'missing' ? 401 : 403, quota);
  }

  let refunded = false;
  const userId = caller.userId;
  return {
    ok: true,
    userId,
    quota: { used: result.used, limit: result.limit },
    refund: async () => {
      if (refunded) return;
      refunded = true;
      try { await store.refundChat(userId); } catch (error) {
        console.error('refundChat failed:', error instanceof Error ? error.message : 'unknown error');
      }
    },
  };
}

/** Bọc onFinish: lượt lỗi/hủy mà chưa có chữ nào → hoàn lượt. */
export function refundingOnFinish(onFinish: (r: TurnResult) => void, refund: () => Promise<void>): (r: TurnResult) => void {
  return r => {
    if (r.status !== 'ok' && !r.text.trim()) void refund();
    onFinish(r);
  };
}

/** Gắn header lượt còn lại vào response (bỏ qua nếu response bất biến). */
export function withQuotaHeader(response: Response, quota: Quota): Response {
  try { response.headers.set('X-Chat-Quota', quotaHeader(quota)); } catch { /* headers bất biến */ }
  return response;
}
