/**
 * Port lưu tài khoản tự đăng ký và hạn mức câu chat. Chỉ dùng phía server.
 * Adapter: neon-user-store (Postgres), memory-user-store (test); disabled khi thiếu DATABASE_URL.
 */
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'locked';
export const USER_STATUSES: readonly UserStatus[] = ['pending', 'approved', 'rejected', 'locked'];
export const DEFAULT_CHAT_LIMIT = 5;

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  status: UserStatus;
  /** null = không giới hạn */
  chatLimit: number | null;
  chatUsed: number;
  createdAt: string;
  approvedAt: string | null;
  lastLoginAt: string | null;
}

export type PublicUser = Omit<UserRecord, 'passwordHash'>;

export type ConsumeResult =
  | { ok: true; used: number; limit: number | null }
  | { ok: false; reason: 'missing' | 'inactive' | 'quota'; used?: number; limit?: number | null; cost?: number };

export type UserUpdate =
  | { action: 'approve' }
  | { action: 'reject' }
  | { action: 'lock' }
  | { action: 'unlock' }
  | { action: 'add'; amount: number }
  | { action: 'setLimit'; limit: number | null };

export interface UserStore {
  readonly enabled: boolean;
  /** 'taken' nếu trùng tên đăng nhập. */
  createUser(username: string, passwordHash: string): Promise<{ id: string } | 'taken'>;
  findByUsername(username: string): Promise<UserRecord | null>;
  getById(id: string): Promise<PublicUser | null>;
  markLogin(id: string): Promise<void>;
  /** Trừ `cost` lượt (mặc định 1) nguyên tử: chỉ khi tài khoản đã duyệt và còn đủ lượt. */
  consumeChat(id: string, cost?: number): Promise<ConsumeResult>;
  /** Hoàn `cost` lượt (lượt lỗi trước khi AI kịp trả lời). */
  refundChat(id: string, cost?: number): Promise<void>;
  listUsers(status?: UserStatus): Promise<PublicUser[]>;
  countByStatus(): Promise<Record<UserStatus, number>>;
  updateUser(id: string, update: UserUpdate): Promise<PublicUser | null>;
}

export const MAX_CHAT_LIMIT = 100_000;
/** Số tài khoản chờ duyệt tối đa: quá thì tạm dừng đăng ký (chặn spam). */
export const MAX_PENDING = 200;

/** Kiểm tra và chuẩn hóa thao tác admin gửi lên; null nếu không hợp lệ. */
export function parseUserUpdate(body: unknown): UserUpdate | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  switch (b.action) {
    case 'approve': case 'reject': case 'lock': case 'unlock':
      return { action: b.action };
    case 'add':
      return Number.isInteger(b.amount) && (b.amount as number) > 0 && (b.amount as number) <= MAX_CHAT_LIMIT
        ? { action: 'add', amount: b.amount as number } : null;
    case 'setLimit':
      if (b.limit === null) return { action: 'setLimit', limit: null };
      return Number.isInteger(b.limit) && (b.limit as number) >= 0 && (b.limit as number) <= MAX_CHAT_LIMIT
        ? { action: 'setLimit', limit: b.limit as number } : null;
    default:
      return null;
  }
}

/** Thông báo cho người dùng khi không trừ được lượt. */
export function consumeErrorMessage(r: Extract<ConsumeResult, { ok: false }>): string {
  if (r.reason === 'quota') {
    const left = Math.max((r.limit ?? 0) - (r.used ?? 0), 0);
    if ((r.cost ?? 1) > 1 && left > 0) return `Câu hỏi này cần ${r.cost} lượt, bạn chỉ còn ${left} lượt. Liên hệ admin để được mở thêm.`;
    return `Bạn đã dùng hết ${r.limit ?? 0} câu hỏi. Liên hệ admin để được mở thêm.`;
  }
  if (r.reason === 'inactive') return 'Tài khoản chưa được duyệt hoặc đã bị khóa.';
  return 'Phiên đăng nhập không còn hợp lệ, vui lòng đăng nhập lại.';
}
