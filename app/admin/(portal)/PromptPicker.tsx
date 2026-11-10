'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import s from '@/app/admin/admin.module.css';

/** Nút chọn version prompt; đổi xong tải lại dữ liệu trang. */
export function PromptPicker({ version, active, disabled }: { version: string; active: boolean; disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (active) return <span className={s.badgeOk}>Đang dùng</span>;

  async function choose() {
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/admin/prompt-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Không đổi được version.');
        return;
      }
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className={s.button} onClick={choose} disabled={pending || disabled}>
        {pending ? 'Đang đổi…' : 'Dùng version này'}
      </button>
      {error && <p role="alert" className={s.error}>{error}</p>}
    </div>
  );
}
