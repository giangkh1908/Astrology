import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminTabs } from './AdminTabs';
import { requireAdminPage } from './guard';
import s from './admin.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Quản trị', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className={s.shell}>
      <header className={s.header}>
        <h1 className={s.title}>Quản trị</h1>
        <Link href="/" className={s.home}>← Về trang chính</Link>
      </header>
      <AdminTabs />
      {children}
    </div>
  );
}
