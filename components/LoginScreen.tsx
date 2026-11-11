'use client';

/** Form đăng nhập dùng chung cho tài khoản thường (/login) và tài khoản admin (/admin/login). */
import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/next-path';

interface LoginFormProps {
  /** API đăng nhập (tài khoản thường hoặc admin). */
  endpoint: string;
  title: string;
  subtitle: string;
  /** Chỉ cho quay lại đường dẫn bắt đầu bằng prefix này; còn lại về fallback. */
  nextPrefix?: string;
  fallback?: string;
  /** Có giá trị thì hiện liên kết "Đăng ký" dưới nút đăng nhập. */
  registerHref?: string;
}

function LoginForm({ endpoint, title, subtitle, nextPrefix = '/', fallback = '/', registerHref }: LoginFormProps) {
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
      const res = await fetch(endpoint, {
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
      const next = safeNextPath(params.get('next'));
      window.location.assign(next !== '/' && next.startsWith(nextPrefix) ? next : fallback);
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
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--tx-0)', margin: '0 0 6px' }}>{title}</h1>
      <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: '0 0 24px' }}>{subtitle}</p>

      <label style={label} htmlFor="username">Tên đăng nhập</label>
      <input id="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} style={{ ...input, marginBottom: '16px' }} />

      <label style={label} htmlFor="password">Mật khẩu</label>
      <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={{ ...input, marginBottom: '20px' }} />

      {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--ji)', margin: '0 0 14px' }}>{error}</p>}

      <button type="submit" disabled={pending} style={{ width: '100%', padding: '11px', fontSize: '14px', fontWeight: 600, borderRadius: '8px', border: 'none', background: 'var(--ac)', color: '#fff', cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
        {pending ? 'Đang kiểm tra…' : 'Đăng nhập'}
      </button>

      {registerHref && (
        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: '16px 0 0', textAlign: 'center' }}>
          Chưa có tài khoản? <a href={registerHref} style={{ color: 'var(--ac)', textDecoration: 'underline' }}>Đăng ký</a>
        </p>
      )}
    </form>
  );
}

/** Khung trang đăng nhập dùng chung cho /login và /admin/login. */
export function LoginScreen(props: LoginFormProps) {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'var(--bg-page)' }}>
      <Suspense>
        <LoginForm {...props} />
      </Suspense>
    </main>
  );
}
