import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminLogout } from '@/app/admin/AdminLogout';
import { AdminTabs } from '@/app/admin/AdminTabs';
import { requireAdminPage } from '@/app/admin/guard';
import s from '@/app/admin/admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Quản trị', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className={s.shell}>
      <header className={s.header}>
        <h1 className={s.title}>Quản trị</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/" className={s.home}>← Về trang chính</Link>
          <AdminLogout />
        </div>
      </header>
      <AdminTabs />
      {children}
    </div>
  );
}
