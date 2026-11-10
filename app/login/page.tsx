'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/session';

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Đăng nhập thất bại.');
        return;
      }
      // Tải lại toàn trang để proxy đọc cookie mới.
      window.location.assign(safeNextPath(params.get('next')));
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px',
    border: '1px solid var(--bdr-med)', background: 'var(--bg-0)', color: 'var(--tx-0)', fontFamily: 'var(--font)',
  };
  const label: React.CSSProperties = { display: 'block', fontSize: '11px', color: 'var(--tx-2)', marginBottom: '6px', letterSpacing: '0.05em' };

  return (
    <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: '360px', padding: '32px 28px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--bdr)', boxShadow: 'var(--sh-md)' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--tx-0)', margin: '0 0 6px' }}>Đăng nhập</h1>
      <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: '0 0 24px' }}>Trang này chỉ dành cho tài khoản được cấp.</p>

      <label style={label} htmlFor="username">Tên đăng nhập</label>
      <input id="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} style={{ ...input, marginBottom: '16px' }} />

      <label style={label} htmlFor="password">Mật khẩu</label>
      <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={{ ...input, marginBottom: '20px' }} />

      {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--ji)', margin: '0 0 14px' }}>{error}</p>}

      <button type="submit" disabled={pending} style={{ width: '100%', padding: '11px', fontSize: '14px', fontWeight: 600, borderRadius: '8px', border: 'none', background: 'var(--ac)', color: '#fff', cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
        {pending ? 'Đang kiểm tra…' : 'Đăng nhập'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'var(--bg-page)' }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
