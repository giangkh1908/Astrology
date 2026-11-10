'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import s from './admin.module.css';

const TABS = [
  { href: '/admin', label: 'Prompt' },
  { href: '/admin/charts', label: 'Lá số' },
  { href: '/admin/logs', label: 'Log' },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className={s.tabs}>
      {TABS.map(t => {
        const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
        return <Link key={t.href} href={t.href} className={active ? s.tabActive : s.tab} aria-current={active ? 'page' : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
