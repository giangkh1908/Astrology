/** Regression coverage for lib/chat/slash-commands.ts (lệnh "/" trong khung luận giải). */
import assert from 'node:assert/strict';
import {
  buildCommands, filterCommands, parseSlash, resolveCommand, isTypingCommand, slugVi, TOPICS,
} from '../../lib/chat/slash-commands';

// 12 cung giả, theo thứ tự địa chi (không phải thứ tự truyền thống)
const zh = ['命', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'];
const palaces = zh.map((name, i) => ({ branch: (i + 2) % 12, name: `${name}宫`, isShenGong: name === '官禄' }));
const cmds = buildCommands(palaces);
const names = cmds.map(c => c.name);

// slug
assert.equal(slugVi('Sự nghiệp'), 'su-nghiep');
assert.equal(slugVi('Điền Trạch'), 'dien-trach');
assert.equal(slugVi('Huynh_Đệ'), 'huynh-de');

// đủ 6 chủ đề + 12 cung + cung Thân + 2 thao tác, tên không trùng
assert.equal(cmds.length, 6 + 12 + 1 + 2);
assert.equal(new Set(names).size, names.length);
for (const t of TOPICS) assert.ok(names.includes(t.name), t.name);
assert.ok(names.includes('su-nghiep'));
assert.ok(names.includes('cung-quan-loc'));
assert.ok(names.includes('cung-menh'));
assert.ok(names.includes('luan-lai'));
assert.ok(names.includes('dong'));

// cung xếp theo thứ tự truyền thống, bắt đầu từ Mệnh
const palaceNames = cmds.filter(c => c.group === 'palace').map(c => c.name);
assert.equal(palaceNames[0], 'cung-menh');
assert.equal(palaceNames[1], 'cung-huynh-de');
assert.equal(palaceNames[11], 'cung-phu-mau');

// cung Thân trỏ về đúng cung có Thân cư, cùng luồng với cung đó
const than = cmds.find(c => c.name === 'cung-than')!;
const quanLoc = cmds.find(c => c.name === 'cung-quan-loc')!;
assert.deepEqual(than.action, quanLoc.action);
assert.equal(than.hint, 'Thân cư Quan Lộc');

// không có cung Thân → không có lệnh cung-than
assert.ok(!buildCommands(palaces.map(p => ({ ...p, isShenGong: false }))).some(c => c.name === 'cung-than'));

// parseSlash
assert.equal(parseSlash('xin chào'), null);
assert.deepEqual(parseSlash('/'), { name: '', rest: '' });
assert.deepEqual(parseSlash('/su-nghiep'), { name: 'su-nghiep', rest: '' });
assert.deepEqual(parseSlash('  /su-nghiep   năm nay có nên đổi việc?  '), { name: 'su-nghiep', rest: 'năm nay có nên đổi việc?' });

// đang gõ tên lệnh → hiện gợi ý; có dấu cách → đang gõ câu hỏi
assert.equal(isTypingCommand('/'), true);
assert.equal(isTypingCommand('/su'), true);
assert.equal(isTypingCommand('/su-nghiep '), false);
assert.equal(isTypingCommand('hỏi /su'), false);

// lọc: "/" → tất cả; tiền tố; có dấu; viết tắt; tên cung không cần "cung-"
assert.equal(filterCommands(cmds, '/').length, cmds.length);
assert.equal(filterCommands(cmds, 'su')[0].name, 'su-nghiep');
assert.equal(filterCommands(cmds, 'sự ng')[0].name, 'su-nghiep');
assert.equal(filterCommands(cmds, 'tài')[0].name, 'tai-van');
assert.equal(filterCommands(cmds, 'sn')[0].name, 'su-nghiep');
assert.equal(filterCommands(cmds, 'quan')[0].name, 'cung-quan-loc');
assert.equal(filterCommands(cmds, 'cung-ph')[0].name, 'cung-phu-the');
assert.equal(filterCommands(cmds, 'zzz').length, 0);

// resolve khi Enter
assert.equal(resolveCommand(cmds, 'su-nghiep')?.name, 'su-nghiep');
assert.equal(resolveCommand(cmds, 'sn')?.name, 'su-nghiep');
assert.equal(resolveCommand(cmds, ''), undefined);
assert.equal(resolveCommand(cmds, 'zzz'), undefined);

console.log('slash-commands: ok');
