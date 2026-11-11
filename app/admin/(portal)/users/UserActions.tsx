'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import s from '@/app/admin/admin.module.css';

type Action =
  | { action: 'approve' | 'reject' | 'lock' | 'unlock' }
  | { action: 'add'; amount: number }
  | { action: 'setLimit'; limit: number | null };

/** Nút thao tác cho một tài khoản; xong thì tải lại dữ liệu trang. */
export function UserActions({ id, status, limit }: { id: string; status: string; limit: number | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [value, setValue] = useState('');

  async function run(body: Action, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Không thực hiện được.');
        return;
      }
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  function saveLimit() {
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n) || n < 0) { setError('Giới hạn phải là số nguyên không âm.'); return; }
    void run({ action: 'setLimit', limit: n });
    setValue('');
  }

  const btn = (label: string, body: Action, ghost = true, confirmText?: string) => (
    <button type="button" className={ghost ? s.buttonGhost : s.button} disabled={pending} onClick={() => run(body, confirmText)}>{label}</button>
  );

  return (
    <div>
      <div className={s.actions}>
        {status === 'pending' && <>
          {btn('Duyệt', { action: 'approve' }, false)}
          {btn('Từ chối', { action: 'reject' }, true, 'Từ chối tài khoản này?')}
        </>}
        {status === 'approved' && <>
          {limit !== null && <>
            {btn('+5', { action: 'add', amount: 5 })}
            {btn('+20', { action: 'add', amount: 20 })}
          </>}
          <input type="number" min={0} step={1} inputMode="numeric" className={s.numInput} value={value}
            onChange={e => setValue(e.target.value)} aria-label="Giới hạn câu hỏi" placeholder="Giới hạn" disabled={pending} />
          <button type="button" className={s.buttonGhost} disabled={pending} onClick={saveLimit}>Đặt giới hạn · Lưu</button>
          {limit !== null && btn('Không giới hạn', { action: 'setLimit', limit: null })}
          {btn('Khóa', { action: 'lock' }, true, 'Khóa tài khoản này?')}
        </>}
        {status === 'locked' && btn('Mở khóa', { action: 'unlock' }, false)}
        {status === 'rejected' && btn('Duyệt', { action: 'approve' }, false)}
      </div>
      {error && <p role="alert" className={s.error}>{error}</p>}
    </div>
  );
}
