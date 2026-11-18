/**
 * Lưới chặn cuối phía server cho bài luận Kinh Dịch: bỏ chữ Hán (và dấu câu CJK) khỏi chữ AI trước khi gửi /
 * lưu, rồi dọn vỏ rỗng còn sót: "()", "（）", "****", "“”", '""'. Prompt đã cấm viết chữ Hán; đây chỉ là lưới an toàn.
 *
 * Chạy theo luồng (chữ về từng mảnh): chữ Hán bỏ ngay được (không phụ thuộc ngữ cảnh); riêng dấu mở ở cuối mảnh
 * (mở ngoặc / dãy dấu * / ngoặc kép, kèm khoảng trắng trước nó) được giữ tới mảnh sau, vì nếu bên trong toàn chữ
 * Hán thì cả vỏ phải bỏ, không để lọt "(" hay "**" mồ côi.
 */

const HAN = /[\p{Script=Han}\u3000-\u303f\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]/gu;
/** Dấu mở còn treo ở cuối (đã bỏ chữ Hán): chưa biết bên trong có chữ hay không. */
const OPEN_TAIL = /[ \t]*(?:[(（]|\*+|[“"])[ \t]*$/u;

export const hasHan = (text: string) => /\p{Script=Han}/u.test(text);

/** Dọn vỏ rỗng do bỏ chữ Hán để lại (chỉ gọi khi thật sự vừa bỏ chữ Hán). */
function clean(text: string): string {
  return text
    .replace(/[ \t]*[(（][ \t]*[)）]/g, '')
    // cặp ** rỗng: đứng sau khoảng trắng / đầu dòng / mở ngoặc, để "**a** **b**" không bị dính
    .replace(/(^|[\s(（])[ \t]*\*\*[ \t]*\*\*(?=[\s,.;:!?)）]|$)/gm, '$1')
    .replace(/[ \t]*“[ \t]*”/g, '')
    .replace(/[ \t]*"[ \t]*"/g, '')
    .replace(/[ \t]+([,.;:!?…])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Bỏ chữ Hán khỏi một đoạn trọn vẹn và dọn vỏ rỗng còn lại. */
export function stripHan(text: string): string {
  const t = text.replace(HAN, '');
  return t.length === text.length ? text : clean(t);
}

export interface TextFilter {
  /** Nhận một mảnh chữ, trả phần đã chắc chắn (có thể rỗng nếu đang giữ đuôi). */
  push(chunk: string): string;
  /** Hết luồng: trả phần còn giữ. */
  flush(): string;
}

export function createHanStripper(): TextFilter {
  let pending = '';
  let pendingHan = false; // phần đang giữ có dính chữ Hán vừa bỏ → khi nhả cần dọn vỏ
  return {
    push(chunk) {
      const stripped = chunk.replace(HAN, '');
      const han = pendingHan || stripped.length !== chunk.length;
      const t = pending + stripped;
      const tail = OPEN_TAIL.exec(t);
      const head = tail ? t.slice(0, tail.index) : t;
      pending = tail ? tail[0] : '';
      pendingHan = tail ? han : false;
      return han ? clean(head) : head;
    },
    flush() {
      const rest = pendingHan ? clean(pending) : pending;
      pending = '';
      pendingHan = false;
      return rest;
    },
  };
}
