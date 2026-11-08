/**
 * Địa chỉ gốc của site. Khi triển khai, đặt NEXT_PUBLIC_SITE_URL trong .env.local (xem .env.example).
 * Nếu chưa đặt thì dùng địa chỉ phát triển cục bộ, tránh sitemap/canonical trỏ tới domain của người khác.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** Chỉ lấy phần tên miền, dùng để hiển thị trên giao diện (ví dụ chân thẻ chia sẻ) */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

/** Tên site và khẩu hiệu */
export const SITE_NAME = 'Tử Vi Đẩu Số';
export const SITE_TAGLINE = 'Lập lá số theo Thiên Kỷ';
export const SITE_DESCRIPTION =
  'Lập lá số Tử Vi Đẩu Số theo hệ thống Thiên Kỷ của Nghê Hải Hạ: cách cục mệnh bàn, đại hạn, lưu niên, tình cảm, sự nghiệp, tài lộc, sức khỏe.';
