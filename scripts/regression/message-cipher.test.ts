import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  ADMIN_HIDDEN, canRevealToAdmin, createMessageCipher, isEncrypted, requireKeyInProduction,
} from '../../lib/crypto/message-cipher';

async function main() {
  const key = randomBytes(32).toString('base64url');
  const c = createMessageCipher(key);
  assert.equal(c.encrypting, true);

  // Mã hoá → không còn chữ gốc, giải mã ra đúng (cả tiếng Việt, emoji, chuỗi rỗng).
  for (const text of ['Hỏi về sự nghiệp năm 2027 🙏', '', 'a'.repeat(5000)]) {
    const sealed = await c.seal(text);
    assert.ok(isEncrypted(sealed), 'có tiền tố enc:v1:');
    assert.ok(!sealed.includes('sự nghiệp'), 'không lộ chữ gốc');
    assert.equal(await c.open(sealed), text);
  }
  // IV ngẫu nhiên: cùng một câu mã hoá hai lần ra hai chuỗi khác nhau.
  assert.notEqual(await c.seal('giống nhau'), await c.seal('giống nhau'));

  // Dữ liệu cũ chưa mã hoá đọc ra nguyên văn.
  assert.equal(await c.open('tin nhắn cũ'), 'tin nhắn cũ');

  // Sai khoá hoặc dữ liệu bị sửa → không ném lỗi, trả rỗng (tin bị ẩn, không hiện chữ báo lỗi cho người dùng).
  const other = createMessageCipher(randomBytes(32).toString('base64url'));
  const sealed = await c.seal('bí mật');
  assert.notEqual(await other.open(sealed), 'bí mật');
  assert.equal(await other.open(sealed), '');
  const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'B' : 'A') + sealed.slice(-1);
  assert.equal(await c.open(tampered), '');

  // Không có khoá: ghi chữ thường, đọc tin đã mã hoá ra rỗng.
  const plain = createMessageCipher(undefined);
  assert.equal(plain.encrypting, false);
  assert.equal(await plain.seal('x'), 'x');
  assert.equal(await plain.open(sealed), '');

  // Khoá sai độ dài → báo ngay khi tạo.
  assert.throws(() => createMessageCipher('ngắn quá'), /32 byte/);

  // Admin chỉ xem được nội dung ở máy local và khi tự bật; trên Vercel bật cũng không được.
  assert.equal(canRevealToAdmin({}), false);
  assert.equal(canRevealToAdmin({ ADMIN_SHOW_MESSAGES: '1' }), true);
  assert.equal(canRevealToAdmin({ ADMIN_SHOW_MESSAGES: '1', VERCEL: '1' }), false);
  assert.equal(ADMIN_HIDDEN, '•••');

  // Production thiếu khoá → chặn (không bao giờ ghi chữ thường lên prod).
  assert.throws(() => requireKeyInProduction({ VERCEL_ENV: 'production' }), /MESSAGE_ENCRYPTION_KEY/);
  assert.doesNotThrow(() => requireKeyInProduction({ VERCEL_ENV: 'production', MESSAGE_ENCRYPTION_KEY: key }));
  assert.doesNotThrow(() => requireKeyInProduction({ VERCEL_ENV: 'preview' }));
  assert.doesNotThrow(() => requireKeyInProduction({}));

  console.log('message-cipher: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
