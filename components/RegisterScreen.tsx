'use client';

/** Form tự đăng ký (tên đăng nhập + mật khẩu). Tài khoản mới chờ admin duyệt. */
import { useState, type FormEvent } from 'react';

const USERNAME_RE = /^[a-z0-9._-]+$/;

function validate(username: string, password: string, confirm: string): string {
  const u = username.trim().toLowerCase();
  if (u.length < 3 || u.length > 32 || !USERNAME_RE.test(u)) {
    return 'Tên đăng nhập gồm 3–32 ký tự: chữ thường không dấu, số, dấu . _ -';
  }
  if (password.length < 8 || password.length > 128) return 'Mật khẩu phải từ 8 đến 128 ký tự.';
  if (password !== confirm) return 'Mật khẩu nhập lại không khớp.';
  return '';
}

export function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validate(username, password, confirm);
    if (problem) { setError(problem); return; }
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Đăng ký thất bại.');
        return;
      }
      setDone(typeof data.message === 'string' ? data.message : 'Đăng ký thành công. Vui lòng chờ admin duyệt tài khoản.');
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
  const link: React.CSSProperties = { color: 'var(--ac)', textDecoration: 'underline' };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'var(--bg-page)' }}>
      <form onSubmit={onSubmit} noValidate style={{ width: '100%', maxWidth: '360px', padding: '32px 28px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--bdr)', boxShadow: 'var(--sh-md)' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--tx-0)', margin: '0 0 6px' }}>Đăng ký</h1>

        {done ? (
          <>
            <p role="status" style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--tx-1, var(--tx-0))', margin: '12px 0 24px' }}>{done}</p>
            <a href="/login" style={{ ...link, fontSize: '14px' }}>Về trang đăng nhập</a>
          </>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: '0 0 24px' }}>Tạo tài khoản để xem lá số và hỏi AI. Tài khoản cần được admin duyệt trước khi dùng.</p>

            <label style={label} htmlFor="username">Tên đăng nhập</label>
            <input id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} aria-describedby="username-hint" value={username} onChange={e => setUsername(e.target.value)} style={{ ...input, marginBottom: '6px' }} />
            <p id="username-hint" style={{ fontSize: '11px', color: 'var(--tx-3)', margin: '0 0 16px' }}>3–32 ký tự: chữ thường không dấu, số, . _ -</p>

            <label style={label} htmlFor="password">Mật khẩu</label>
            <input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} style={{ ...input, marginBottom: '16px' }} />

            <label style={label} htmlFor="confirm">Nhập lại mật khẩu</label>
            <input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} style={{ ...input, marginBottom: '20px' }} />

            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--ji)', margin: '0 0 14px' }}>{error}</p>}

            <button type="submit" disabled={pending} style={{ width: '100%', padding: '11px', fontSize: '14px', fontWeight: 600, borderRadius: '8px', border: 'none', background: 'var(--ac)', color: '#fff', cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending ? 'Đang gửi…' : 'Đăng ký'}
            </button>

            <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: '16px 0 0', textAlign: 'center' }}>
              Đã có tài khoản? <a href="/login" style={link}>Đăng nhập</a>
            </p>
          </>
        )}
      </form>
    </main>
  );
}
