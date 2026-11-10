/** Hàm thuần, dùng được ở client (trang login) mà không kéo theo mã xác thực phía server. */
/**
 * Chỉ cho chuyển hướng về đường dẫn nội bộ, chống open redirect (`//evil.com`, `/\evil.com`,
 * và `/<tab>/evil.com` — trình duyệt bỏ tab/xuống dòng khi parse URL nên thành `//evil.com`).
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(next)) return '/';
  const base = 'http://local.invalid';
  let url: URL;
  try { url = new URL(next, base); } catch { return '/'; }
  if (url.origin !== base) return '/';
  const path = url.pathname + url.search + url.hash;
  return path.startsWith('/login') || path.startsWith('/admin/login') ? '/' : path;
}
