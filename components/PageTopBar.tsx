'use client';
/** Thanh trên cùng dùng chung cho các trang con (Lá số, Hợp bàn, Kinh Dịch): "‹ Quay lại" về trang chủ | tên trang | phần phụ bên phải. */
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PageTopBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'color-mix(in srgb, var(--bg-0) 90%, transparent)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--bdr)',
        display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', gap: '16px',
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--tx-3)' }}>
        <span style={{ fontSize: '16px' }}>‹</span>
        <span>Quay lại</span>
      </Link>
      <div style={{ width: '1px', height: '20px', background: 'var(--bdr-med)' }} />
      <span style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em', whiteSpace: 'nowrap' }}>{title}</span>
      <div style={{ flex: 1 }} />
      {right}
    </header>
  );
}
