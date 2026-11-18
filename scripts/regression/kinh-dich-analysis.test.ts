import assert from 'node:assert/strict';
import { computeCast, hexagramByBits, hexagramByNumber, type LineValue } from '../../lib/kinh-dich/core';
import {
  analyzeCast, castSeason, lineTable, mainLine, relatedHexagrams, trigramOf, wuxingStates,
} from '../../lib/kinh-dich/analysis';
import data from '../../lib/kinh-dich/data/hexagrams.json';

const hex = (n: number) => hexagramByNumber(n)!;
const L = (s: string) => s.split('').map(Number) as LineValue[];

// ---- Quẻ hỗ / thác / tổng
const qian = relatedHexagrams(hex(1));
assert.equal(qian.hỗ.number, 1);
assert.equal(qian.thác.number, 2);
assert.equal(qian.tổng.number, 1);
assert.equal(qian.tổngLàChínhNó, true);

const zhun = relatedHexagrams(hexagramByBits('100010')); // Truân #3
assert.equal(zhun.hỗ.number, 23); // Bác
assert.equal(zhun.thác.number, 50); // Đỉnh
assert.equal(zhun.tổng.number, 4); // Mông
assert.equal(zhun.tổngLàChínhNó, false);

assert.equal(relatedHexagrams(hex(63)).hỗ.number, 64); // Ký Tế hỗ Vị Tế
assert.equal(relatedHexagrams(hex(11)).tổng.number, 12); // Thái ↔ Bĩ
assert.equal(relatedHexagrams(hex(11)).thác.number, 12);
assert.equal(relatedHexagrams(hex(29)).tổngLàChínhNó, true); // Khảm đối xứng
// Thác của thác = chính nó; tổng của tổng = chính nó, với cả 64 quẻ
for (const h of data.hexagrams) {
  const r = relatedHexagrams(hexagramByBits(h.bits));
  assert.equal(relatedHexagrams(r.thác).thác.number, h.number);
  assert.equal(relatedHexagrams(r.tổng).tổng.number, h.number);
}

// ---- Bát quái: khớp trường upper/lower của dữ liệu cho cả 64 quẻ
for (const h of data.hexagrams) {
  assert.equal(trigramOf(h.bits.slice(0, 3)).tên, h.lower, `quẻ dưới #${h.number}`);
  assert.equal(trigramOf(h.bits.slice(3)).tên, h.upper, `quẻ trên #${h.number}`);
}
assert.deepEqual(trigramOf('100'), { tên: 'Chấn', tượng: 'sấm', đức: 'động', ngũ_hành: 'Mộc', gia_đình: 'trưởng nam' });
assert.equal(trigramOf('110').tên, 'Đoài');
assert.equal(trigramOf('110').ngũ_hành, 'Kim');
assert.equal(trigramOf('001').tên, 'Cấn');

// ---- Bảng hào
const jiji = lineTable(hex(63), [3]);
assert.ok(jiji.every(r => r.chính_vị === 'đắc chính'));
assert.ok(jiji.every(r => r.ứng.quan_hệ === 'chính ứng'));
assert.equal(jiji[2].động, true);
assert.equal(jiji[0].động, false);
assert.equal(jiji[1].trung, true);
assert.equal(jiji[2].trung, false);
assert.equal(jiji[0].tên, 'Sơ Cửu');
assert.equal(jiji[1].tên, 'Lục Nhị');
assert.equal(jiji[0].ứng.với, 4);
assert.equal(jiji[1].thừa, 'thừa hào 3 (âm dưới dương, thuận)');
assert.equal(jiji[1].cưỡi, 'cưỡi hào 1 (âm trên dương — thừa cương, nghịch)');
assert.equal(jiji[0].thừa, undefined);
assert.equal(jiji[5].thừa, undefined); // hào 6 không có hào trên
const weiji = lineTable(hex(64));
assert.ok(weiji.every(r => r.chính_vị === 'thất chính'));
assert.ok(weiji.every(r => r.ứng.quan_hệ === 'chính ứng'));
assert.equal(weiji[0].động, undefined); // không truyền hào động → không có trường động
assert.ok(lineTable(hex(1)).every(r => r.ứng.quan_hệ === 'vô ứng'));

// ---- Hào chủ
assert.equal(mainLine(hex(24)).hào, 1); // Phục: một dương dưới năm âm
assert.equal(mainLine(hex(23)).hào, 6); // Bác
assert.equal(mainLine(hex(8)).hào, 5); // Tỷ
assert.equal(mainLine(hex(63)).hào, 5); // Ký Tế: hào 5 đắc trung đắc chính
assert.equal(mainLine(hex(1)).hào, 5); // Càn
assert.equal(mainLine(hex(64)).hào, null); // Vị Tế: hào 5 âm, không có hào lẻ loi
assert.ok(mainLine(hex(64)).lý_do.length > 0);
assert.equal(mainLine(hex(2)).hào, null); // Khôn

// ---- Ngũ hành vượng tướng hưu tù tử
assert.deepEqual(wuxingStates('Thủy'), { Thủy: 'vượng', Mộc: 'tướng', Kim: 'hưu', Thổ: 'tù', Hỏa: 'tử' });
assert.deepEqual(wuxingStates('Thổ'), { Thổ: 'vượng', Kim: 'tướng', Hỏa: 'hưu', Mộc: 'tù', Thủy: 'tử' });

// ---- Thời điểm gieo (giờ Việt Nam UTC+7)
const nov17 = castSeason(new Date('2026-11-17T03:00:00Z')); // 10:00 VN
assert.equal(nov17.tiết_khí, 'Lập Đông');
assert.equal(nov17.mùa, 'Đông');
assert.equal(nov17.tứ_quý, false);
assert.equal(nov17.tháng_lệnh, 'Hợi');
assert.equal(nov17.hành_đương_lệnh, 'Thủy');
assert.equal(nov17.vượng_suy.Thủy, 'vượng');
assert.equal(nov17.can_chi_tháng, 'Kỷ Hợi');
assert.equal(nov17.can_chi_ngày, 'Ất Mùi');
// Ranh giới Lập Đông 2026-11-07 17:52 (giờ Bắc Kinh UTC+8) = 16:52 VN
assert.equal(castSeason(new Date('2026-11-07T09:40:00Z')).tiết_khí, 'Sương Giáng'); // 16:40 VN
assert.equal(castSeason(new Date('2026-11-07T09:40:00Z')).hành_đương_lệnh, 'Thổ'); // tháng Tuất
assert.equal(castSeason(new Date('2026-11-07T09:40:00Z')).tứ_quý, true);
assert.equal(castSeason(new Date('2026-11-07T09:40:00Z')).mùa, 'Thu');
assert.equal(castSeason(new Date('2026-11-07T09:55:00Z')).tiết_khí, 'Lập Đông'); // 16:55 VN
assert.equal(castSeason(new Date('2026-11-07T09:55:00Z')).hành_đương_lệnh, 'Thủy');
// Múi giờ: 2026-11-16T18:00Z đã là 01:00 ngày 17 ở VN
assert.equal(castSeason(new Date('2026-11-16T18:00:00Z')).can_chi_ngày, 'Ất Mùi');
assert.equal(castSeason(new Date('2026-03-25T05:00:00Z')).tiết_khí, 'Xuân Phân');
assert.equal(castSeason(new Date('2026-03-25T05:00:00Z')).hành_đương_lệnh, 'Mộc');

// ---- Tổng hợp
const cast = computeCast(L('988878')); // Truân 100010, hào 1 động → biến Tỷ #8
assert.equal(cast.main.number, 3);
const a = analyzeCast(cast, new Date('2026-11-17T03:00:00Z'));
assert.equal(a.hỗ_quái.số, 23);
assert.equal(a.quẻ_thác.số, 50);
assert.equal(a.quẻ_tổng.số, 4);
assert.equal(a.quái_dưới.tên, 'Chấn');
assert.equal(a.quái_trên.tên, 'Khảm');
assert.equal(a.quái_trên.vượng_suy, 'vượng');
assert.equal(a.quái_dưới.vượng_suy, 'tướng');
assert.equal(a.bảng_hào.length, 6);
assert.equal(a.bảng_hào[0].động, true);
assert.ok(a.quẻ_biến);
assert.equal(a.quẻ_biến!.số, cast.changed!.number);
assert.equal(a.quẻ_biến!.bảng_hào[0].động, undefined);
assert.ok(a.quẻ_biến!.hỗ_quái);
assert.equal(a.cặp_nhị_ngũ.quan_hệ, 'chính ứng');
assert.equal(a.thời_điểm_gieo.tiết_khí, 'Lập Đông');
assert.doesNotThrow(() => JSON.parse(JSON.stringify(a)));
assert.equal(analyzeCast(computeCast(L('787878')), new Date('2026-11-17T03:00:00Z')).quẻ_biến, null);

console.log('kinh-dich-analysis: ok');
