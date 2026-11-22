# Gói Tình duyên + Kiểm chứng lá số — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm prompt v4 gồm (1) "gói luật" theo chủ đề — bắt đầu bằng gói Tình duyên với tool `quet_cac_nam` giàu tín hiệu hơn — và (2) mục "Kiểm chứng lá số": AI quét các năm đã qua, hỏi người dùng 3 năm nổi bật bằng thẻ hỏi, câu trả lời thành hoàn cảnh cho mọi mục khác.

**Architecture:** Chỉ dùng dữ liệu engine đã tính (iztro + `lib/ziwei/*`); không thêm sao/bảng an sao mới. Gói luật là đoạn văn bản nạp vào system prompt theo intent (field mới `topicPack` của `InterpretationStyle`). Kiểm chứng là một chủ đề mới trong `TOPICS`, dùng lại tool `hoi_nguoi_dung` và cơ chế "lời kể ở mục khác" (`priorNotes`) để lưu — không cần bảng DB mới.

**Tech Stack:** Next.js 16, TypeScript, iztro 2.5.8, test bằng `tsx` + `node:assert/strict` trong `scripts/regression/`.

**Spec:** Cuộc trao đổi ngày 2026-11-22 (không có file spec riêng). Các quyết định đã chốt được chép vào Global Constraints.

## Global Constraints

- Làm trên nhánh mới `feat/goi-tinh-duyen-kiem-chung` từ `main`; commit sau mỗi task; KHÔNG push, KHÔNG merge.
- Không thêm sao hay công thức an sao ngoài engine. Không có Lưu Thiên Khốc/Lưu Thiên Hư. Không thêm bảng quan hệ địa chi (tam hợp/xung/hình/hại/Tam Tai) hay sinh khắc can — engine không có.
- Được dùng: sao lưu iztro (`layer.stars`), vòng Thái Tuế (`yearlyDecStar.suiqian12`), vòng Tướng Tinh (`yearlyDecStar.jiangqian12`, trong đó `咸池` = Lưu Đào Hoa), vòng Bác Sĩ (`boshiShenName` ở `lib/ziwei/shier-shen.ts`), sao lá số gốc (`chart.palaces[].stars`).
- Kết quả tool và prompt không được chứa chữ Hán (regex `/[㐀-鿿]/`); tên sao luôn qua `viStar`, địa chi qua `viBranch`, cung qua `viPalace`.
- Version v1, v2, v3 phải giữ hành vi hiện tại (chỉ được thêm field vào kết quả tool và thêm chủ đề `kiem_chung`).
- Kiểm tra: chỉ chạy test liên quan + `npm run typecheck`. KHÔNG chạy `npm run harness` / `npm test` đầy đủ / `next build`. Không chạy eval với model thật.
- Mọi chữ hiển thị cho người dùng bằng tiếng Việt có dấu.

## Review Focus

1. Người dùng còn trẻ (tuổi âm < 20) mở Kiểm chứng: gần như không có năm đã qua đáng hỏi → AI phải nói thẳng là chưa đủ quá khứ để kiểm chứng, không bịa câu hỏi. (Pin: assert trong Task 4 rằng gói verify có câu này.)
2. Người dùng trả lời "Không đúng" cả 3 năm → AI không được chữa cho khớp; phải nói có thể giờ sinh chưa chuẩn. (Pin: Task 4.)
3. Câu trả lời thẻ hỏi lưu vào lịch sử chỉ có nhãn ngắn ("2019: Đúng") → mục khác không hiểu đúng/sai cái gì. (Pin: Task 2 — câu trả lời kèm nội dung câu hỏi.)
4. Mở mục Kiểm chứng bằng câu hỏi tự động: route hiện tắt `hoi_nguoi_dung` khi câu hỏi là tự động → mục này sẽ không bao giờ hỏi được. (Pin: Task 5 test `askUserAllowed`.)
5. Năm iztro không có `yearlyDecStar` hoặc không có `咸池` → tool không được vỡ, chỉ bỏ trường Lưu Đào Hoa. (Pin: Task 1 — hàm trả `undefined`, test với layer rỗng.)

---

### Task 1: Tín hiệu Tình duyên trong `quet_cac_nam` và Lưu Đào Hoa trong `xem_van_han`

**Files:**
- Modify: `lib/ai/tools/ziwei-tools.ts` (helper trong `buildChartTools`, tool `quetCacNam` ~dòng 349–395, `flowStars`/`signals` ~dòng 123–165)
- Create: `scripts/regression/ai-love-signals.test.ts`
- Modify: `package.json` (thêm `tsx scripts/regression/ai-love-signals.test.ts` vào cuối chuỗi `test`)

**Interfaces:**
- Produces (export từ `ziwei-tools.ts`, để test được độc lập):
  - `export function peachBranchOfLayer(layer: unknown): number | undefined` — địa chi (0 = Tý) của `咸池` trong `layer.yearlyDecStar.jiangqian12` (mảng 12 phần tử, chỉ số i ↔ địa chi `(i + 2) % 12`); không có thì `undefined`.
- Produces (field mới trong mỗi phần tử `các_năm` của `quet_cac_nam`, mọi `chu_de`):
  - `tiểu_hạn: string` — `"<địa chi> (cung gốc <tên cung>)"`, ví dụ `"Thìn (cung gốc Nô Bộc)"`; địa chi = `branchOfIndex(h.age.index)`.
  - `lưu_đào_hoa?: string` — `viBranch(peachBranchOfLayer(h.yearly))`, bỏ nếu undefined.
  - Lưu Đào Hoa được tính vào `tín_hiệu`/`tốt` y như sao lưu tốt khác: vào bản cung +2, xung chiếu +1, tam hợp bỏ qua; fact dạng `"Lưu Đào Hoa vào bản cung"` / `"Lưu Đào Hoa xung chiếu"`.
- Produces (chỉ khi `chu_de === 'phu_the'`):
  - `hỷ_tín_tiểu_hạn: { sao: string[]; điểm: number }` — sao lá số gốc thuộc nhóm hỷ tinh nằm ở tam phương tứ chính của cung tiểu hạn. Mỗi phần tử `"<tên sao> (<vị trí>)"`, vị trí ∈ `vào bản cung | xung chiếu | tam hợp`. Điểm: bản cung 2, xung chiếu/tam hợp 1.
    - Nhóm sao gốc (khóa Trung trong `palace.stars[].name`): `咸池, 红鸾, 天喜, 天姚, 龙池, 凤阁, 左辅, 右弼`.
    - Cộng thêm `喜神`, `青龙` lấy bằng `boshiShenName(chart().lunarInfo.yearStem, birthInfo.gender, branch)`.
  - `đại_hạn_ở_tam_hợp_phu_thê: boolean` — địa chi đại hạn (`branchOfIndex(h.decadal.index)`) ∈ {Phu Thê gốc, +4, +8 mod 12}.
- Produces (`xem_van_han`): `lưu_niên.sao_lưu` có thêm mục `{ sao: 'Lưu Đào Hoa', địa_chi, cung_gốc, cung_lưu_niên }` khi có.
- Cập nhật chuỗi `cách_đọc` của `quet_cac_nam`: thêm câu "hỷ_tín_tiểu_hạn (chỉ có với phu_the) đếm sao hỷ của lá số gốc hội về cung tiểu hạn; đại_hạn_ở_tam_hợp_phu_thê = đại hạn đang ở Phu Thê/Thiên Di/Phúc Đức gốc."
- Cập nhật `description` của `quet_cac_nam`: thêm "tiểu hạn, Lưu Đào Hoa; với phu_the có thêm hỷ tín hội tiểu hạn".

Lá số kiểm (đã đối chiếu tay + engine ngày 2026-11-22): `{ year: 1955, month: 12, day: 28, hour: 1, gender: 'male', lunarTimeZone: 7 }` — Nam Ất Mùi, Mệnh Hợi, Phu Thê Dậu, Thổ ngũ cục, đại hạn 25–34 ở Dậu. Sao gốc: Thân có Hồng Loan; Dần có Thiên Hỷ, Tả Phù; Tý có Đào Hoa (咸池), Hữu Bật; Hợi có Thiên Riêu, Long Trì; Mão có Phượng Các. Vòng Bác Sĩ: Hỷ Thần ở Thân, Thanh Long ở Sửu.

- [ ] **Step 1: Tạo nhánh**

```bash
git checkout -b feat/goi-tinh-duyen-kiem-chung
```

- [ ] **Step 2: Viết test thất bại `scripts/regression/ai-love-signals.test.ts`**

```ts
import assert from 'node:assert/strict';
import { buildChartTools, peachBranchOfLayer } from '../../lib/ai/tools/ziwei-tools';
import { viStar } from '../../lib/vn/terms';
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const info = { year: 1955, month: 12, day: 28, hour: 1, gender: 'male', lunarTimeZone: 7 } as never;
const tools = buildChartTools(info);
const quet = tools.find(t => t.name === 'quet_cac_nam')!;
const q = quet.run({ chu_de: 'phu_the', tu_nam: 1982, den_nam: 1986 }) as Any;
assert.equal(JSON.stringify(q).match(/[㐀-鿿]/), null, 'còn chữ Hán');
const y = (n: number) => q.các_năm.find((x: Any) => x.năm_âm_lịch === n);

// Tiểu hạn: Hợi Mão Mùi khởi Sửu, nam thuận → 28 tuổi Thìn, 29 Tị, 32 Thân
assert.equal(y(1982).tiểu_hạn, 'Thìn (cung gốc Nô Bộc)');
assert.equal(y(1983).tiểu_hạn, 'Tị (cung gốc Thiên Di)');
assert.equal(y(1986).tiểu_hạn, 'Thân (cung gốc Tử Tức)');
// Lưu Đào Hoa theo chi năm: Tuất → Mão, Hợi → Tý, Dần → Mão
assert.deepEqual([y(1982).lưu_đào_hoa, y(1983).lưu_đào_hoa, y(1986).lưu_đào_hoa], ['Mão', 'Tý', 'Mão']);
// Đại hạn 25–34 ở Dậu = Phu Thê
for (const n of [1982, 1983, 1986]) assert.equal(y(n).đại_hạn_ở_tam_hợp_phu_thê, true);

const has = (n: number, zh: string, where: string) =>
  assert.ok(y(n).hỷ_tín_tiểu_hạn.sao.includes(`${viStar(zh)} (${where})`), `${n}: thiếu ${zh} ${where}`);
// 1982 tiểu hạn Thìn: Thân (Hồng Loan, Hỷ Thần) và Tý (Đào Hoa, Hữu Bật) tam hợp → 4 điểm
has(1982, '红鸾', 'tam hợp'); has(1982, '喜神', 'tam hợp'); has(1982, '咸池', 'tam hợp'); has(1982, '右弼', 'tam hợp');
assert.equal(y(1982).hỷ_tín_tiểu_hạn.điểm, 4);
// 1983 tiểu hạn Tị: Hợi xung (Thiên Riêu, Long Trì), Sửu tam hợp (Thanh Long) → 3 điểm
has(1983, '天姚', 'xung chiếu'); has(1983, '龙池', 'xung chiếu'); has(1983, '青龙', 'tam hợp');
assert.equal(y(1983).hỷ_tín_tiểu_hạn.điểm, 3);
// 1986 tiểu hạn Thân: bản cung Hồng Loan + Hỷ Thần (2+2), Tý tam hợp (1+1), Dần xung Thiên Hỷ + Tả Phù (1+1) → 8
has(1986, '红鸾', 'vào bản cung'); has(1986, '天喜', 'xung chiếu'); has(1986, '左辅', 'xung chiếu');
assert.equal(y(1986).hỷ_tín_tiểu_hạn.điểm, 8);

// Chủ đề khác không có trường riêng của Tình duyên, nhưng vẫn có tiểu hạn
const career = quet.run({ chu_de: 'quan_loc', tu_nam: 1982, den_nam: 1982 }) as Any;
assert.equal(career.các_năm[0].hỷ_tín_tiểu_hạn, undefined);
assert.equal(career.các_năm[0].đại_hạn_ở_tam_hợp_phu_thê, undefined);
assert.equal(career.các_năm[0].tiểu_hạn, 'Thìn (cung gốc Nô Bộc)');

// xem_van_han: Lưu Đào Hoa có trong sao lưu năm
const v = tools.find(t => t.name === 'xem_van_han')!.run({ nam: 1982 }) as Any;
assert.equal(v.lưu_niên.sao_lưu.find((s: Any) => s.sao === 'Lưu Đào Hoa')?.địa_chi, 'Mão');

// Layer thiếu dữ liệu không làm vỡ
assert.equal(peachBranchOfLayer({}), undefined);
assert.equal(peachBranchOfLayer({ yearlyDecStar: { jiangqian12: [] } }), undefined);

console.log('AI love signals regression passed');
```

- [ ] **Step 3: Chạy để thấy thất bại**

Run: `npx tsx scripts/regression/ai-love-signals.test.ts`
Expected: FAIL (`peachBranchOfLayer` không được export / `tiểu_hạn` undefined).

- [ ] **Step 4: Cài đặt trong `lib/ai/tools/ziwei-tools.ts`**

`peachBranchOfLayer` ở mức module (dùng `branchOfIndex` sẵn có). Trong `buildChartTools`: helper `hyTin(focus: number)` dùng cùng quy tắc vị trí như `where()` của `signals` (tách `where` ra helper chung `relation(b, focus)` để dùng lại, không chép). Lưu Đào Hoa cộng vào `signals` khi layer có `yearlyDecStar` (chỉ lưu niên có). Import `boshiShenName` từ `@/lib/ziwei/shier-shen`.

- [ ] **Step 5: Chạy test mới và test cũ của tool**

Run: `npx tsx scripts/regression/ai-love-signals.test.ts && npx tsx scripts/regression/ai-chart-tools.test.ts && npx tsx scripts/regression/heming-tools.test.ts`
Expected: cả ba in dòng `... passed`.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add lib/ai/tools/ziwei-tools.ts scripts/regression/ai-love-signals.test.ts package.json
git commit -m "Tool quét năm: thêm tiểu hạn, Lưu Đào Hoa, hỷ tín tiểu hạn cho Phu Thê"
```

---

### Task 2: Câu trả lời thẻ hỏi kèm nội dung câu hỏi

**Files:**
- Modify: `lib/ai/ask-user.ts:118-124` (`formatAnswers`)
- Modify: `scripts/regression/ask-user.test.ts:63-64`

**Interfaces:**
- Produces: `formatAnswers(ask, answers)` trả về
  `"Trả lời câu hỏi:\n- <nhan> — <noi_dung>: <đáp án | bỏ qua>"` mỗi câu một dòng.
  Lý do: câu trả lời được lưu như lời người dùng và đi sang mục khác qua `priorNotes`; chỉ có nhãn ngắn thì mục khác không biết người dùng xác nhận điều gì.

- [ ] **Step 1: Sửa 2 assert ở `ask-user.test.ts` theo định dạng mới**

Dùng `p` sẵn có trong test (câu "Hôn nhân", "Con cái"); expected ví dụ:
`'Trả lời câu hỏi:\n- Hôn nhân — ' + p.cau_hoi[0].noi_dung + ': Đã kết hôn\n- Con cái — ' + p.cau_hoi[1].noi_dung + ': bỏ qua'`.

- [ ] **Step 2: Chạy, thấy FAIL**

Run: `npx tsx scripts/regression/ask-user.test.ts` → FAIL ở dòng formatAnswers.

- [ ] **Step 3: Sửa `formatAnswers`**

- [ ] **Step 4: Chạy lại test hỏi lại**

Run: `npx tsx scripts/regression/ask-user.test.ts && npx tsx scripts/regression/ask-agent-loop.test.ts && npx tsx scripts/regression/interpret-ask-route.test.ts`
Expected: đều passed. Nếu test khác so khớp chuỗi cũ "Trả lời câu hỏi:\n- Nhãn: …", sửa expected theo định dạng mới (không đổi logic).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/ask-user.ts scripts/regression/ask-user.test.ts
git commit -m "Thẻ hỏi: câu trả lời kèm nội dung câu hỏi để mục khác hiểu"
```

---

### Task 3: Chủ đề "Kiểm chứng" (dùng được ở mọi version)

**Files:**
- Modify: `lib/chat/slash-commands.ts:7-14` (`TOPICS`)
- Modify: `lib/prompts/shared.ts` (`intentGuidance` topics map ~dòng 132; `pickInitialQuestion` ~dòng 232)
- Test: `scripts/regression/slash-commands.test.ts`, `scripts/regression/prompt-versions.test.ts`

**Interfaces:**
- Produces: phần tử TOPICS `{ key: 'kiem_chung', name: 'kiem-chung', label: 'Kiểm chứng', hint: 'Đối chiếu chuyện đã qua' }` (đặt cuối mảng).
- Produces: `export const VERIFY_QUESTION = 'Hãy kiểm chứng lá số này với những chuyện đã qua của tôi.'` trong `shared.ts`; `pickInitialQuestion` trả `VERIFY_QUESTION` khi `intent.key === 'kiem_chung'` (không gắn đuôi "năm âm lịch hiện tại").
- Produces: `intentGuidance` thêm `kiem_chung: 'Kiểm chứng lá số với chuyện đã qua: tra các năm đã qua bằng quet_cac_nam, chọn vài năm có tín hiệu mạnh nhất và hỏi người dùng năm đó có đúng chuyện ấy không. Không khẳng định quá khứ; chỉ hỏi.'`

- [ ] **Step 1: Thêm assert vào test**

`slash-commands.test.ts`: `buildCommands([])` có lệnh `name === 'kiem-chung'` với `action` `{ type: 'open', key: 'kiem_chung', label: 'Kiểm chứng' }`. Nếu test đang assert số lượng TOPICS = 6 thì đổi thành 7.
`prompt-versions.test.ts`: với v1 và v2, `initialInterpretationQuestion({ type: 'topic', key: 'kiem_chung' }) === VERIFY_QUESTION`.

- [ ] **Step 2: Chạy, thấy FAIL**

Run: `npx tsx scripts/regression/slash-commands.test.ts && npx tsx scripts/regression/prompt-versions.test.ts`

- [ ] **Step 3: Cài đặt**

- [ ] **Step 4: Chạy lại + test liên quan lịch sử/lời kể**

Run: `npx tsx scripts/regression/slash-commands.test.ts && npx tsx scripts/regression/prompt-versions.test.ts && npx tsx scripts/regression/prior-notes.test.ts && npx tsx scripts/regression/chat-history.test.ts`
Expected: đều passed.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add lib/chat/slash-commands.ts lib/prompts/shared.ts scripts/regression/slash-commands.test.ts scripts/regression/prompt-versions.test.ts
git commit -m "Thêm chủ đề Kiểm chứng lá số"
```

---

### Task 4: Gói luật theo chủ đề (Tình duyên, Kiểm chứng) + chỗ cắm trong prompt

**Files:**
- Create: `lib/prompts/packs/love.ts`, `lib/prompts/packs/verify.ts`, `lib/prompts/packs/index.ts`
- Modify: `lib/prompts/shared.ts` (`InterpretationStyle` thêm field; `buildInterpretationPrompt` chèn khối ngay sau dòng `Yêu cầu phân tích: …`)
- Create: `scripts/regression/topic-packs.test.ts`; Modify: `package.json` (thêm vào chuỗi `test`)

**Interfaces:**
- Produces: `export const LOVE_PACK: string`, `export const VERIFY_PACK: string`.
- Produces: `export function topicPackFor(chart: ZiweiChart, intent: InterpretationIntent): string | undefined` trong `packs/index.ts`:
  - `intent.type === 'topic' && key === 'love'` → `LOVE_PACK`
  - `intent.type === 'palace'` và cung tại `intent.branch` có `name === '夫妻'` → `LOVE_PACK`
  - `intent.type === 'topic' && key === 'kiem_chung'` → `VERIFY_PACK`
  - còn lại → `undefined`
- Produces: `InterpretationStyle.topicPack?: (chart: ZiweiChart, intent: InterpretationIntent) => string | undefined`. `buildInterpretationPrompt` chèn chuỗi trả về (nếu có) thành một đoạn riêng. v1–v3 không đặt field này → prompt của chúng không đổi.

Nội dung cố định (chép nguyên văn; mỗi gói là các dòng nối bằng `\n`):

`LOVE_PACK`:
```
Gói luật Tình duyên (chỉ dùng dữ kiện do công cụ tính):
- Nền: cung Phu Thê và tam phương tứ chính của nó (Phu Thê, Thiên Di, Phúc Đức, xung chiếu từ Quan Lộc). Nhóm sao hỷ: Đào Hoa, Hồng Loan, Thiên Hỷ, Thiên Riêu, Long Trì, Phượng Các, Tả Phù, Hữu Bật, Hỷ Thần, Thanh Long.
- Câu hỏi "bao giờ cưới / năm nào có người yêu": gọi quet_cac_nam(chu_de=phu_the, tu_nam, den_nam), xét theo thứ tự: (1) năm có đại_hạn_ở_tam_hợp_phu_thê là chặng thuận; (2) trong chặng đó, ưu tiên năm có hỷ_tín_tiểu_hạn cao và tín_hiệu tốt ở Phu Thê lưu niên (Lưu Hồng Loan, Lưu Thiên Hỷ, Lưu Đào Hoa, Hóa Lộc hay Hóa Khoa); (3) Hóa Kỵ, Lưu Kình Dương hay Lưu Đà La vào bản cung là điểm trừ. Chọn 1–2 năm rồi soi bằng xem_van_han và xem_cung.
- Không dùng Tam Tai, xung, hình, hại giữa địa chi năm và tuổi, hay sinh khắc giữa can năm và can tuổi để chọn hoặc loại năm: công cụ không tính các thứ này.
- Tuần, Triệt ở Phu Thê chỉ nói là có thể chậm hoặc phải thu xếp, không khẳng định.
- Chưa biết người dùng đã kết hôn hay đang có người yêu thì hỏi trước. Đã kết hôn thì không đi tìm năm cưới; nếu người dùng đã kể năm cưới thật (kể cả ở mục Kiểm chứng) thì dùng năm đó làm mốc đối chiếu.
- Nói "năm có tín hiệu rõ nhất", không hứa chắc sẽ cưới.
```

`VERIFY_PACK`:
```
Gói luật Kiểm chứng lá số:
- Mục đích: đối chiếu lá số với chuyện đã qua để người dùng tự thấy độ khớp. Không khẳng định điều gì đã xảy ra; chỉ hỏi.
- Bước 1: gọi quet_cac_nam cho chu_de phu_the, quan_loc và tai_bach với các năm đã qua, từ năm đương số 18 tuổi âm đến năm âm lịch trước năm nay; mỗi lần tối đa 15 năm, gọi song song.
- Bước 2: chọn đúng 3 năm có tín hiệu mạnh nhất (tốt hoặc xấu), ưu tiên mỗi năm một chủ đề khác nhau. Gọi hoi_nguoi_dung với 3 câu hỏi, mỗi câu một năm: nhãn là năm dương lịch (ví dụ "2019"); nội dung nêu năm âm lịch kèm khoảng dương lịch và loại việc có thể đã xảy ra, hỏi trung tính (ví dụ "có thay đổi lớn về tình cảm như quen người mới, cưới hay chia tay không?"); lựa chọn: "Đúng", "Gần đúng (lệch một năm)", "Không đúng". Không nêu tên sao.
- Đương số dưới 20 tuổi âm thì nói thẳng là chưa đủ chuyện đã qua để kiểm chứng, không đặt câu hỏi.
- Bước 3, sau khi người dùng trả lời: nói ngắn lá số khớp mấy trên 3 năm và ý nghĩa của từng năm. Khớp từ 1 năm trở xuống thì nói thẳng có thể giờ sinh chưa chuẩn và gợi ý kiểm tra lại giờ sinh; không giải thích gượng cho khớp. Mời người dùng kể thêm mốc thật (năm cưới, năm đổi việc, năm mua nhà) để các mục khác luận sát hơn.
- Người dùng muốn thêm một lượt thì chọn 3 năm khác, không hỏi lại năm đã hỏi.
```

- [ ] **Step 1: Viết test `scripts/regression/topic-packs.test.ts`**

Assert:
- `topicPackFor(chart, { type: 'topic', key: 'love' }) === LOVE_PACK`; với `{ type: 'palace', branch: <branch cung 夫妻 của chart> }` cũng `=== LOVE_PACK`; với `{ type: 'palace', branch: chart.mingGongBranch }` là `undefined`; `kiem_chung` → `VERIFY_PACK`; `career` → `undefined`.
- Không gói nào có chữ Hán.
- Mọi tên tool dạng `ten_tool(` trong gói là tool có thật trong `buildChartTools(...)` + `hoi_nguoi_dung`; mọi tham số trong ngoặc là tham số thật của schema (cùng cách kiểm như `ai-prompt-tools-match.test.ts`).
- Mọi trường gói nhắc (`đại_hạn_ở_tam_hợp_phu_thê`, `hỷ_tín_tiểu_hạn`, `tín_hiệu`) có thật trong `JSON.stringify(quet_cac_nam.run({ chu_de: 'phu_the', tu_nam: 2026, den_nam: 2027 }))`.
- `VERIFY_PACK` chứa `'dưới 20 tuổi âm'` và `'giờ sinh chưa chuẩn'` (Review Focus 1, 2).
- Prompt v2 dựng với intent love KHÔNG chứa `'Gói luật Tình duyên'` (v1–v3 không đổi).

Lá số test: `{ year: 1990, month: 5, day: 12, hour: 6, gender: 'female', lunarTimeZone: 7 }`.

- [ ] **Step 2: Chạy, thấy FAIL** — `npx tsx scripts/regression/topic-packs.test.ts`

- [ ] **Step 3: Tạo 3 file pack + field `topicPack` + chèn khối trong `buildInterpretationPrompt`**

- [ ] **Step 4: Chạy lại**

Run: `npx tsx scripts/regression/topic-packs.test.ts && npx tsx scripts/regression/prompt-versions.test.ts && npx tsx scripts/regression/ai-prompt-tools-match.test.ts`
Expected: đều passed.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add lib/prompts/packs lib/prompts/shared.ts scripts/regression/topic-packs.test.ts package.json
git commit -m "Gói luật theo chủ đề: Tình duyên và Kiểm chứng"
```

---

### Task 5: Prompt v4 + route cho phép hỏi ở mục Kiểm chứng

**Files:**
- Create: `lib/prompts/v4/index.ts`
- Modify: `lib/prompts/index.ts` (thêm v4 vào `PromptVersionId`, `PROMPT_VERSIONS`, `SETS`)
- Modify: `lib/prompts/v3/index.ts` (export `ASK_RULE`, `TIME_RULES`, `windowFacts` để v4 dùng lại — không đổi nội dung)
- Modify: `lib/ai/ask-user.ts` (hàm mới), `app/api/interpret/route.ts` (dòng tính `askUser`)
- Test: `scripts/regression/prompt-versions.test.ts`, `scripts/regression/ai-prompt-tools-match.test.ts`, `scripts/regression/ask-user.test.ts`

**Interfaces:**
- Consumes: `topicPackFor` (Task 4), `VERIFY_QUESTION` (Task 3).
- Produces: `promptSetV4: PromptSet` — giống v3 hoàn toàn, khác ở:
  - `style.topicPack = topicPackFor`
  - mục `kiem_chung` là "không có khái niệm khung 3 tháng" như `personality` (không có `windowFacts`, câu hỏi tự động = `VERIFY_QUESTION`).
- Produces: `PROMPT_VERSIONS` thêm `{ id: 'v4', label: 'v4 – gói luật chủ đề, kiểm chứng', description: 'Như v3, thêm gói luật riêng cho từng chủ đề (bắt đầu với Tình duyên) và mục Kiểm chứng lá số hỏi lại chuyện đã qua.' }`. `defaultPromptVersion` giữ nguyên `'v2'`.
- Produces: `export function askUserAllowed(version: string, opts: { hiddenQuestion: boolean; topicKey?: string; trailing: number }): boolean` trong `ask-user.ts`:
  - `false` nếu `trailing >= MAX_CONSECUTIVE_ASKS`
  - `version === 'v3'` → `!hiddenQuestion`
  - `version === 'v4'` → `!hiddenQuestion || topicKey === 'kiem_chung'`
  - còn lại `false`
- Route: `const askUser = askUserAllowed(version, { hiddenQuestion, topicKey: intent.type === 'topic' ? intent.key : undefined, trailing: trailingAsks(messages) });`

- [ ] **Step 1: Cập nhật test**

- `prompt-versions.test.ts`: đổi `assert.deepEqual(PROMPT_VERSIONS.map(v => v.id), ['v1', 'v2', 'v3'])` thành có `'v4'`; thêm: prompt v4 intent love chứa `'Gói luật Tình duyên'` và `'hoi_nguoi_dung'`; prompt v4 intent `kiem_chung` chứa `'Gói luật Kiểm chứng'` và KHÔNG chứa `'Dữ kiện lưu nguyệt khung 3 tháng'`; `promptSetV4.initialInterpretationQuestion({ type: 'topic', key: 'kiem_chung' }) === VERIFY_QUESTION`.
- `ai-prompt-tools-match.test.ts`: dòng `const timeHint = id === 'v3' ? …` đổi thành `['v3', 'v4'].includes(id) ? …`.
- `ask-user.test.ts`: `askUserAllowed('v4', { hiddenQuestion: true, topicKey: 'kiem_chung', trailing: 0 }) === true`; `('v4', { hiddenQuestion: true, topicKey: 'love', trailing: 0 }) === false`; `('v3', { hiddenQuestion: true, topicKey: 'kiem_chung', trailing: 0 }) === false`; `('v4', { hiddenQuestion: false, trailing: 2 }) === false`; `('v2', { hiddenQuestion: false, trailing: 0 }) === false`.

- [ ] **Step 2: Chạy, thấy FAIL**

Run: `npx tsx scripts/regression/prompt-versions.test.ts`

- [ ] **Step 3: Cài đặt v4, đăng ký version, `askUserAllowed`, sửa route**

- [ ] **Step 4: Chạy lại test liên quan**

Run: `npx tsx scripts/regression/prompt-versions.test.ts && npx tsx scripts/regression/ai-prompt-tools-match.test.ts && npx tsx scripts/regression/ask-user.test.ts && npx tsx scripts/regression/interpret-ask-route.test.ts && npx tsx scripts/regression/admin-api.test.ts && npx tsx scripts/regression/chat-history.test.ts`
Expected: đều passed. (`admin-api` kiểm danh sách version cho /admin; nếu nó assert đúng 3 version thì cập nhật expected thêm v4.)

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add lib/prompts lib/ai/ask-user.ts app/api/interpret/route.ts scripts/regression
git commit -m "Prompt v4: gói luật chủ đề và mục Kiểm chứng được hỏi lại ngay khi mở"
```

---

### Task 6: Kiểm tra cuối nhánh

- [ ] **Step 1: Chạy toàn bộ test đã đụng tới + typecheck**

Run: `npm run typecheck && npx tsx scripts/regression/ai-love-signals.test.ts && npx tsx scripts/regression/topic-packs.test.ts && npx tsx scripts/regression/ai-chart-tools.test.ts && npx tsx scripts/regression/heming-tools.test.ts && npx tsx scripts/regression/ask-user.test.ts && npx tsx scripts/regression/ask-agent-loop.test.ts && npx tsx scripts/regression/interpret-ask-route.test.ts && npx tsx scripts/regression/slash-commands.test.ts && npx tsx scripts/regression/prompt-versions.test.ts && npx tsx scripts/regression/ai-prompt-tools-match.test.ts && npx tsx scripts/regression/prior-notes.test.ts && npx tsx scripts/regression/chat-history.test.ts && npx tsx scripts/regression/admin-api.test.ts`
Expected: typecheck sạch, mọi file in `passed`.

- [ ] **Step 2: `git log --oneline main..HEAD`** — 5 commit, cây làm việc sạch. Không push.

Việc để người dùng tự làm sau (ghi trong báo cáo, không làm trong plan): chọn v4 ở /admin, thử trên trình duyệt mục Tình cảm và Kiểm chứng, quyết định có chạy eval với model thật.
