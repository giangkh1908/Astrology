import type { Metadata } from 'next';
import KinhDichApp from '@/components/kinh-dich/KinhDichApp';

export const metadata: Metadata = {
  title: 'Kinh Dịch · Gieo quẻ',
  robots: { index: false },
};

export default function KinhDichPage() {
  return <KinhDichApp />;
}
