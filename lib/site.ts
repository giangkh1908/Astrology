/**
 * Địa chỉ gốc của site. Khi triển khai, đặt NEXT_PUBLIC_SITE_URL trong .env.local (xem .env.example).
 * Nếu chưa đặt thì dùng địa chỉ phát triển cục bộ, tránh sitemap/canonical trỏ tới domain của người khác.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** Chỉ lấy phần tên miền, dùng để hiển thị trên giao diện (ví dụ chân thẻ chia sẻ) */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

/** Tên site và khẩu hiệu */
export const SITE_NAME = 'Tử Vi Đẩu Số';
export const SITE_TAGLINE = 'Lá số, hợp bàn và Kinh Dịch có AI luận giải';
export const SITE_DESCRIPTION =
  'Lập lá số Tử Vi Đẩu Số, hợp bàn hai người và gieo quẻ Kinh Dịch. Lịch âm Việt Nam, giờ mặt trời thật, AI luận giải và hỏi lại khi cần.';
