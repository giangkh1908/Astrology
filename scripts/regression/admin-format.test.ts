import assert from 'node:assert/strict';
import { describeBirth, formatDateTime, threadLabel } from '../../app/admin/format';

// Định dạng hiển thị của trang quản trị: giờ Việt Nam, mô tả ngày sinh, tên luồng chat tiếng Việt.

// Giờ Việt Nam (UTC+7), dạng dd/mm/yyyy HH:mm.
assert.equal(formatDateTime('2026-11-10T03:05:00.000Z'), '10/11/2026 10:05');
assert.equal(formatDateTime('2026-11-10T20:30:00Z'), '11/11/2026 03:30');
assert.equal(formatDateTime('không phải ngày'), '(không rõ)');

// Mô tả ngày sinh (dữ liệu giả).
assert.equal(describeBirth({ year: 1990, month: 3, day: 5, hour: 1, gender: 'male' }), '05/03/1990 · giờ Sửu · Nam');
assert.equal(describeBirth({ year: 1992, month: 8, day: 20, hour: 7, gender: 'female', twinMethod: 'huynh_de' }), '20/08/1992 · giờ Mùi · Nữ · sinh đôi (Huynh Đệ)');
assert.equal(describeBirth({ year: 1992, month: 8, day: 20, hour: 0, gender: 'female', twinMethod: 'thien_di' }), '20/08/1992 · giờ Tý · Nữ · sinh đôi (Thiên Di)');
assert.equal(describeBirth({ year: 1990, month: 3, day: 5, hour: 1, gender: 'male', name: 'Tên giả' }), 'Tên giả · 05/03/1990 · giờ Sửu · Nam');
assert.equal(describeBirth(null), '(không rõ)');
assert.equal(describeBirth({ year: 'x' }), '(không rõ)');
assert.equal(describeBirth({ year: 1990, month: 3, day: 5, hour: 99, gender: 'male' }), '(không rõ)');

// Tên luồng chat.
assert.equal(threadLabel('overview'), 'Tổng quan · Mệnh cách');
assert.equal(threadLabel('career'), 'Sự nghiệp');
assert.equal(threadLabel('topic-career'), 'Sự nghiệp');
assert.equal(threadLabel('heming'), 'Hợp bàn');
assert.equal(threadLabel('palace:2'), 'Cung tại Dần');
assert.equal(threadLabel('palace-2'), 'Cung tại Dần');
assert.equal(threadLabel('palace:2', b => (b === 2 ? 'Quan Lộc' : undefined)), 'Cung Quan Lộc');
assert.equal(threadLabel('sihua:mingpan:太阳:禄'), 'Tứ hóa · Mệnh bàn · Thái Dương hóa Lộc');
assert.equal(threadLabel('la-key-khac'), 'la-key-khac');

console.log('admin-format: ok');
