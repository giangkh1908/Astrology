'use client';
import { useTheme } from '@/components/ThemeProvider';

/** Nút đổi sáng/tối của landing page; class do trang truyền vào. */
export default function ThemeSwitch({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" onClick={toggle} className={className} aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
      {dark ? 'Sáng' : 'Tối'}
    </button>
  );
}
