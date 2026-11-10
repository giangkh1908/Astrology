'use client';

import { useState } from 'react';
import s from './admin.module.css';

/** Đăng xuất tài khoản admin (không ảnh hưởng phiên của trang chính). */
export function AdminLogout() {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      await fetch('/api/auth/admin/logout', { method: 'POST' });
    } finally {
      window.location.assign('/admin/login');
    }
  }
  return (
    <button type="button" className={s.buttonGhost} onClick={logout} disabled={pending}>
      {pending ? 'Đang thoát…' : 'Đăng xuất admin'}
    </button>
  );
}
