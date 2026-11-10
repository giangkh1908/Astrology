'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

/** Nút đăng xuất + link Quản trị cố định góc dưới phải; ẩn ở trang /login, link Quản trị ẩn khi đang ở /admin. */
export function LogoutButton() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  if (pathname === '/login') return null;

  async function logout() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  const pill: React.CSSProperties = { padding: '6px 12px', fontSize: '12px', borderRadius: '999px', border: '1px solid var(--bdr-med)', background: 'var(--bg-card)', color: 'var(--tx-2)', boxShadow: 'var(--sh-sm)', cursor: 'pointer', textDecoration: 'none', lineHeight: 1.4 };
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  return (
    <div style={{ position: 'fixed', right: '12px', bottom: '12px', zIndex: 50, display: 'flex', gap: '8px' }}>
      {!inAdmin && <Link href="/admin" style={pill}>Quản trị</Link>}
      <button type="button" onClick={logout} disabled={pending} style={pill}>
        {pending ? 'Đang thoát…' : 'Đăng xuất'}
      </button>
    </div>
  );
}
