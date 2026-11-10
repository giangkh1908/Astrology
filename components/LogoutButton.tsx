'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

/** Nút đăng xuất tài khoản trang chính, cố định góc dưới phải; ẩn ở /login và khu /admin (admin có nút riêng). */
export function LogoutButton() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  if (pathname === '/login' || pathname === '/admin' || pathname.startsWith('/admin/')) return null;

  async function logout() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      style={{ position: 'fixed', right: '12px', bottom: '12px', zIndex: 50, padding: '6px 12px', fontSize: '12px', borderRadius: '999px', border: '1px solid var(--bdr-med)', background: 'var(--bg-card)', color: 'var(--tx-2)', boxShadow: 'var(--sh-sm)', cursor: 'pointer' }}
    >
      {pending ? 'Đang thoát…' : 'Đăng xuất'}
    </button>
  );
}
