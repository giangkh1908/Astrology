/**
 * /knowledge — Trang chủ kho tri thức
 * Liệt kê 14 chính tinh, mỗi sao xem được luận đoán theo 13 chủ đề (12 cung)
 */

import Link from 'next/link';
import { ALL_STARS, ALL_TOPICS, getKnowledge, STAR_TO_SLUG } from '@/lib/seo/knowledge';
import { TOPIC_LABEL } from '@/lib/ziwei/db-analysis';

// Bản đồ hiển thị Hán-Việt (cục bộ cho trang tri thức)
const VI_STAR: Record<string, string> = {
  '紫微': 'Tử Vi', '天机': 'Thiên Cơ', '太阳': 'Thái Dương', '武曲': 'Vũ Khúc',
  '天同': 'Thiên Đồng', '廉贞': 'Liêm Trinh', '天府': 'Thiên Phủ', '太阴': 'Thái Âm',
  '贪狼': 'Tham Lang', '巨门': 'Cự Môn', '天相': 'Thiên Tướng', '天梁': 'Thiên Lương',
  '七杀': 'Thất Sát', '破军': 'Phá Quân',
};
const VI_PALACE: Record<string, string> = {
  '命宫': 'Mệnh', '夫妻': 'Phu Thê', '官禄': 'Quan Lộc', '财帛': 'Tài Bạch', '疾厄': 'Tật Ách',
  '兄弟': 'Huynh Đệ', '子女': 'Tử Tức', '迁移': 'Thiên Di', '仆役': 'Nô Bộc', '田宅': 'Điền Trạch',
  '福德': 'Phúc Đức', '父母': 'Phụ Mẫu',
};
const VI_TOPIC: Record<string, string> = {
  overview: 'Tổng quan mệnh cách', personality: 'Tính cách', love: 'Tình cảm hôn nhân',
  career: 'Sự nghiệp', wealth: 'Tài vận', health: 'Sức khỏe', family: 'Huynh đệ hợp tác',
  children: 'Con cái', move: 'Di chuyển xuất ngoại', friends: 'Giao tế quý nhân',
  home: 'Nhà đất bất động sản', spirit: 'Phúc đức tinh thần', parents: 'Cha mẹ bề trên',
};
const viStar = (s: string) => VI_STAR[s] ?? s;
const viPalace = (p: string) => VI_PALACE[p] ?? p;
const viTopic = (t: string, fallback: string) => VI_TOPIC[t] ?? fallback;

const VI_BRIEF: Record<string, string> = {
  '紫微': 'Tử Vi là đế tinh, chủ tôn quý. Tọa Mệnh thường có khí chất lãnh đạo, hợp nền tảng lớn, vị trí cao.',
  '天机': 'Thiên Cơ là sao trí tuệ, chủ linh hoạt, thay đổi. Tọa Mệnh thường thông minh nhanh nhạy, hợp làm tham mưu, hoạch định.',
  '太阳': 'Thái Dương là sao quý của nam, chủ danh tiếng và công quyền. Tọa Mệnh thường quang minh chính đại, hợp công chức, danh vọng.',
  '武曲': 'Vũ Khúc là sao tài, chủ cương nghị quyết đoán. Tọa Mệnh thường giỏi quản lý tiền bạc, hợp thực nghiệp, tài chính.',
  '天同': 'Thiên Đồng là phúc tinh, chủ ôn hòa hưởng thụ. Tọa Mệnh thường tính tình hiền hòa, có phúc khí.',
  '廉贞': 'Liêm Trinh là thứ đào hoa tinh, văn võ song toàn. Tọa Mệnh thường đa tài đa nghệ, tình cảm phong phú.',
  '天府': 'Thiên Phủ là sao giữ của của Nam Đẩu, chủ vững vàng bảo thủ. Tọa Mệnh thường đoan chính, khéo giữ kho tài.',
  '太阴': 'Thái Âm là sao mặt trăng, chủ điền trạch và phú quý. Tọa Mệnh thường tình cảm tinh tế, nữ mệnh rất tốt.',
  '贪狼': 'Tham Lang là đào hoa dục vọng tinh, nhiều tài nghệ, giao tế rộng. Tọa Mệnh thường đa tài, quan hệ xã hội rộng.',
  '巨门': 'Cự Môn là sao thị phi khẩu tài, chủ biện luận, truyền thông. Tọa Mệnh thường ăn nói giỏi, hợp luật sư, giáo viên.',
  '天相': 'Thiên Tướng là ấn tinh phò tá, chủ trung hậu thật thà. Tọa Mệnh thường đoan chính, hợp hành chính, pháp vụ.',
  '天梁': 'Thiên Lương là sao ấm phúc của bậc cao niên, giỏi hóa hung thành cát. Tọa Mệnh thường từ bi lương thiện, hợp luật, y.',
  '七杀': 'Thất Sát là tướng tinh, chủ cô độc, quyết đoán, mạo hiểm. Tọa Mệnh thường cương nghị, hợp quân cảnh, khởi nghiệp.',
  '破军': 'Phá Quân là sao phá hoại và đổi mới, lục thân duyên mỏng. Tọa Mệnh thường khai phá, hay biến động, hợp chuyên môn kỹ thuật.',
};

export const metadata = {
  title: 'Kho tri thức Tử Vi Đẩu Số · 14 chính tinh × 13 chủ đề (12 cung)',
  description: 'Kho tri thức Tử Vi Đẩu Số biên soạn theo cổ thư «Tử Vi Đẩu Số Toàn Tập», «Cốt Tủy Phú». Bao quát luận đoán của 14 chính tinh ở 13 chủ đề (12 cung): định điệu một câu, luận đoán cốt lõi, căn cứ lá số, xuất xứ kinh điển.',
  keywords: ['Tử Vi Đẩu Số', 'Tử Vi', '14 chính tinh', '12 cung', 'Tử Vi Đẩu Số Toàn Tập', 'Tử Vi Đẩu Số Toàn Thư'],
};

export default function KnowledgeHomePage() {
  const STAR_DESCRIPTIONS_QUICK = VI_BRIEF;

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* 顶栏 */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(184,146,42,0.15)', background: 'var(--bg-page)' }}>
        <Link href="/" style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.3em', textDecoration: 'none' }}>
          ← Trang chủ
        </Link>
        <div style={{ fontSize: '12px', color: 'var(--tx-3)', letterSpacing: '0.2em' }}>
          Kho tri thức
        </div>
        <Link href="/library" style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em', textDecoration: 'none' }}>
          Cổ thư →
        </Link>
      </div>

      {/* Hero */}
      <div className="text-center px-6 py-14">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div style={{ height: '1px', width: '48px', background: 'linear-gradient(to right, transparent, rgba(184,146,42,0.4))' }} />
          <span style={{ fontSize: '11px', color: 'var(--ac)', letterSpacing: '0.4em' }}>KNOWLEDGE BASE</span>
          <div style={{ height: '1px', width: '48px', background: 'linear-gradient(to left, transparent, rgba(184,146,42,0.4))' }} />
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: 'var(--tx-0)', letterSpacing: '0.15em', marginBottom: '12px' }}>
          Kho tri thức Tử Vi Đẩu Số
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--tx-2)', letterSpacing: '0.08em', maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
          14 chính tinh × 13 chủ đề (12 cung) = tối đa <strong style={{ color: 'var(--ac)' }}>{ALL_STARS.length * ALL_TOPICS.length}</strong> chuyên đề<br />
          Biên soạn theo hệ thống cổ thư · kèm trích dẫn xuất xứ
        </p>
      </div>

      {/* 14 主星卡片 */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div style={{ fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.3em', textAlign: 'center', marginBottom: '24px' }}>
          Mười bốn chính tinh
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {ALL_STARS.map(star => (
            <Link
              key={star}
              href={`/knowledge/${STAR_TO_SLUG[star]}/overview`}
              style={{
                display: 'block',
                padding: '14px 10px',
                background: 'var(--bg-card)',
                border: '1px solid rgba(184,146,42,0.2)',
                borderRadius: '10px',
                textDecoration: 'none',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
              className="hover:shadow-md hover:border-amber-400"
            >
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tx-0)', letterSpacing: '0.15em' }}>
                {viStar(star)}
              </div>
            </Link>
          ))}
        </div>

        {/* 详细列表（每个主星 + 简介 + 进入按钮） */}
        <div className="mt-14 space-y-4">
          {ALL_STARS.map(star => (
            <div key={star} style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(184,146,42,0.18)',
              borderRadius: '12px',
              padding: '18px 22px',
            }}>
              <div className="flex items-baseline gap-3 mb-2">
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--tx-0)', letterSpacing: '0.1em' }}>
                  Sao {viStar(star)}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.15em' }}>
                  TỬ VI · 14 CHÍNH TINH
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--tx-2)', lineHeight: 1.7, marginBottom: '12px' }}>
                {STAR_DESCRIPTIONS_QUICK[star] || ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_TOPICS.map(t => {
                  const k = getKnowledge(star, t);
                  if (!k.exists) return null;
                  return (
                    <Link
                      key={t}
                      href={`/knowledge/${STAR_TO_SLUG[star]}/${t}`}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        background: 'rgba(184,146,42,0.06)',
                        border: '1px solid rgba(184,146,42,0.15)',
                        borderRadius: '999px',
                        color: 'var(--tx-2)',
                        textDecoration: 'none',
                      }}
                    >
                      Nhập cung {viPalace(k.palaceName)} · {viTopic(t, TOPIC_LABEL[t])}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
