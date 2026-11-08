/**
 * formToBirthInfo: ngày đổi theo giờ Tý muộn phải xét theo GIỜ MẶT TRỜI THẬT, cùng tiêu chuẩn với chi giờ.
 *
 * Giờ mặt trời (phút) = giờ đồng hồ + kinh độ x 4 - độ lệch múi giờ (phút).
 * Chi giờ tính theo giờ mặt trời, nhưng việc đổi ngày từng chỉ nhìn "23 giờ" đồng hồ, hai bên lệch nhau thì
 * ngày lập lá số sai một ngày. Ví dụ (năm 2000, Hà Nội, UTC+7):
 *   - Kinh độ 95 (lệch -40 phút): đồng hồ 23:30 -> giờ mặt trời 22:50, giờ Hợi, không được sang ngày hôm sau;
 *   - Kinh độ 115 (lệch +40 phút): đồng hồ 22:30 -> giờ mặt trời 23:10, giờ Tý muộn, phải sang ngày hôm sau.
 * Quy tắc đổi ngày giống lib/ziwei/true-solar-time.ts resolveZiweiDayOffset('next-day').
 */
import assert from 'node:assert/strict';
import { formToBirthInfo } from '../../lib/ziwei/share';
import type { BirthFormState } from '../../components/BirthForm';

function formAt(clockHour: string, clockMinute: string, longitude: number, province = 'Hà Nội', city = 'Hà Nội'): BirthFormState {
  return {
    name: '',
    year: '2000',
    month: '1',
    day: '31',
    clockHour,
    clockMinute,
    unknownTime: false,
    province,
    city,
    longitude,
    tzOverride: '',
    gender: 'male',
  };
}

const pick = (b: ReturnType<typeof formToBirthInfo>) => ({ year: b.year, month: b.month, day: b.day, hour: b.hour });

// Năm 2000 ở Việt Nam là UTC+7 (kinh tuyến chuẩn 105°); kinh độ chọn để chênh lệch dễ kiểm: (kinh độ - 105) x 4 phút.
const cases: Array<[string, string, number, { year: number; month: number; day: number; hour: number }, string]> = [
  ['23', '30', 105, { year: 2000, month: 2, day: 1, hour: 0 }, 'Kinh độ 105 23:30 giờ Tý muộn -> ngày hôm sau, giờ Tý'],
  ['0', '30', 105, { year: 2000, month: 1, day: 31, hour: 0 }, 'Kinh độ 105 00:30 giờ Tý sớm -> giữ ngày, giờ Tý'],
  ['23', '30', 95, { year: 2000, month: 1, day: 31, hour: 11 }, 'Kinh độ 95 23:30 (mặt trời 22:50) -> cùng ngày, giờ Hợi'],
  ['22', '30', 115, { year: 2000, month: 2, day: 1, hour: 0 }, 'Kinh độ 115 22:30 (mặt trời 23:10) -> ngày hôm sau, giờ Tý'],
  ['0', '30', 65, { year: 2000, month: 1, day: 30, hour: 11 }, 'Kinh độ 65 00:30 (mặt trời 21:50 hôm trước) -> ngày hôm trước, giờ Hợi'],
  ['23', '50', 110, { year: 2000, month: 2, day: 1, hour: 0 }, 'Kinh độ 110 23:50 (mặt trời 00:10 hôm sau) -> ngày hôm sau, giờ Tý'],
];

for (const [h, mi, lon, expected, label] of cases) {
  assert.deepEqual(pick(formToBirthInfo(formAt(h, mi, lon))), expected, label);
}

// Địa điểm thật trong nước: Hà Nội (105.85), Điện Biên Phủ (103.02), Cà Mau (105.15)
assert.deepEqual(pick(formToBirthInfo(formAt('23', '30', 105.85))), { year: 2000, month: 2, day: 1, hour: 0 }, 'Hà Nội 23:30 (mặt trời 23:33) -> ngày hôm sau');
assert.deepEqual(pick(formToBirthInfo(formAt('23', '05', 103.02, 'Điện Biên', 'Điện Biên Phủ'))), { year: 2000, month: 1, day: 31, hour: 11 }, 'Điện Biên Phủ 23:05 (mặt trời 22:57) -> cùng ngày, giờ Hợi');
assert.deepEqual(pick(formToBirthInfo(formAt('23', '10', 103.02, 'Điện Biên', 'Điện Biên Phủ'))), { year: 2000, month: 2, day: 1, hour: 0 }, 'Điện Biên Phủ 23:10 (mặt trời 23:02) -> ngày hôm sau, giờ Tý');

// Chọn múi giờ UTC+8: giờ mặt trời lùi thêm 60 phút (Hà Nội 23:30 -> 22:33, giờ Hợi, không đổi ngày)
{
  const b = formToBirthInfo({ ...formAt('23', '30', 105.85), tzOverride: '480' });
  assert.deepEqual(pick(b), { year: 2000, month: 1, day: 31, hour: 11 }, 'tzOverride UTC+8: 23:30 -> mặt trời 22:33');
  assert.equal(b.utcOffsetMinutes, 480, 'utcOffsetMinutes lấy theo tzOverride');
}

// Múi giờ tự động theo lịch sử: miền Nam 1965 là UTC+8 (Cần Thơ 105.78 -> 23:30 đồng hồ = 22:33 mặt trời)
{
  const f = { ...formAt('23', '30', 105.78, 'Cần Thơ', 'Cần Thơ'), year: '1965' };
  const b = formToBirthInfo(f);
  assert.equal(b.utcOffsetMinutes, 480, 'miền Nam 1965 UTC+8');
  assert.equal(b.region, 'south');
  assert.deepEqual(pick(b), { year: 1965, month: 1, day: 31, hour: 11 }, 'Cần Thơ 1965 23:30 -> giờ Hợi, không đổi ngày');
  assert.equal(b.lunarTimeZone, 8, 'trước 8/1967 âm lịch tính theo UTC+8');
}

// Chưa chọn tỉnh: không hiệu chỉnh kinh độ (giờ mặt trời = giờ đồng hồ)
{
  const b = formToBirthInfo(formAt('23', '30', 95, '', ''));
  assert.deepEqual(pick(b), { year: 2000, month: 2, day: 1, hour: 0 }, 'không chọn tỉnh: bỏ qua kinh độ');
  assert.equal(b.longitude, undefined);
  assert.equal(b.region, 'north');
  assert.equal(b.utcOffsetMinutes, 420);
  assert.equal(b.lunarTimeZone, 7);
}

const unknown = formToBirthInfo({ ...formAt('23', '30', 95), unknownTime: true });
assert.deepEqual(pick(unknown), { year: 2000, month: 1, day: 31, hour: 0 }, 'Không rõ giờ sinh thì không đổi ngày');

console.log('form true-solar day rollover regression passed (VN)');
