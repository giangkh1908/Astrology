# Nguồn và giấy phép dữ liệu Kinh Dịch

`hexagrams.json` được port từ dự án **dich-so** (https://github.com/docsachvathaoluan/dich-so), commit `ebceef1cd20f2e445c622ed511b635dedc556b6d`, bằng `scripts/kinh-dich/port-dich-so.ts`.

- `lines[].textHV` và `lines[].gloss` (Hán-Việt và nghĩa 384 hào), `extra` (Dụng Cửu / Dụng Lục): neo theo bản dịch **_Kinh Dịch trọn bộ_** của **Ngô Tất Tố** (1893–1954) — phạm vi công cộng, **bắt buộc ghi công**.
- `judgment` (Thoán) và `image` (Đại Tượng): nguyên văn kinh văn cổ (phạm vi công cộng) kèm phần tóm ý của dự án dich-so.
- `modernShort` và `lines[].modern`: diễn giải hiện đại của dự án dich-so, giấy phép **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/). **Không phải lời Ngô Tất Tố.** Ứng dụng này không sửa nội dung, chỉ chọn trường và đổi định dạng sang JSON.

## `classics.json` — kinh văn và chú giải chữ Hán (phạm vi công cộng)

Dựng bằng `scripts/kinh-dich/build-classics.ts` từ **Wikisource tiếng Trung** (các trang gắn nhãn `{{PD-old}}`); giữ nguyên chữ phồn thể và dị thể như nguồn, chỉ bỏ mã wiki, chú thích dị bản và chữ nhỏ song hành.

| Trường | Nội dung | Nguồn |
|---|---|---|
| `tuan`, `xiaoXiang`, `yong.xiaoXiang`, `wenyan` | 彖傳, 小象, 文言 (Thập Dực, tương truyền Khổng Tử, thời Xuân Thu – Chiến Quốc) | https://zh.wikisource.org/wiki/周易 (trang con `周易/<quẻ>`) |
| `xugua` | 序卦傳 | https://zh.wikisource.org/wiki/易傳/序卦 |
| `zagua` | 雜卦傳 (nguyên câu chứa quẻ) | https://zh.wikisource.org/wiki/易傳/雜卦 |
| `judgment`, `lines`, `yong` → `cheng` | 程傳 (伊川易傳) của **Trình Di** 程頤 (1033–1107) | https://zh.wikisource.org/wiki/周易傳義大全_(四庫全書本) |
| `judgment`, `lines`, `yong` → `benyi` | 周易本義 của **Chu Hy** 朱熹 (1130–1200) | như trên |

- **周易傳義大全** do Hồ Quảng 胡廣 và các cộng sự biên soạn theo sắc nhà Minh, hoàn thành năm **1415**; bản trên Wikisource chép từ 景印文淵閣四庫全書 (冊 28). Tác giả các văn bản đều mất từ nhiều thế kỷ trước nên toàn bộ thuộc **phạm vi công cộng**. Chỉ lấy phần 程傳 và 本義; lời 諸儒 (chữ nhỏ) bị bỏ.
- Bản chép 四庫全書 trên Wikisource phần lớn **chưa hiệu đính** (proofread level 1), nên có thể sót hoặc sai chữ (ví dụ thiếu chữ 惕 ở vài chỗ). Không sửa tay để giữ đúng nguồn; nếu cần độ chính xác cao, đối chiếu bản in.
- Không dùng dữ liệu từ ctext.org.

## `hanviet.json` — bảng âm Hán Việt (dùng để đối chiếu cụm trích)

Dựng bằng `scripts/kinh-dich/build-hanviet.ts` từ trường `kVietnamese` của cơ sở dữ liệu **Unihan** (Unicode Character Database), https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip. Copyright © Unicode, Inc. Dùng theo **Unicode License v3**: https://www.unicode.org/license.txt.

- Thêm một bảng bổ sung tay nhỏ (`SUPPLEMENT` trong script) cho các âm đọc kinh điển mà Unihan thiếu (ví dụ 未 "vị", 主 "chủ", 二 "nhị", 予 "dư / dữ"); file JSON hiện tại đã được vá trực tiếp theo bảng này.

---

Nguyên văn giấy phép nội dung của dich-so (`LICENSE-CONTENT.md`) chép dưới đây.

---

# Giấy phép nội dung · Content licence

> `LICENSE` (MIT) chỉ áp cho **mã nguồn**. File này áp cho **nội dung chữ nghĩa**:
> diễn giải 64 quẻ, 384 hào từ, và phần bài viết trong ứng dụng.
> `LICENSE` (MIT) covers **code only**. This file covers the **written content**:
> the interpretations of the 64 hexagrams, the 384 line texts, and the app's prose.

---

## Tiếng Việt

Kho này trộn nhiều lớp văn bản có tình trạng pháp lý **khác nhau**. Nói rõ từng lớp
là một phần nguyên tắc của dự án: đã đòi người khác dẫn nguồn thì mình phải dẫn trước.

### 1. Kinh văn cổ: phạm vi công cộng

Nguyên văn Kinh Dịch (Chu Dịch), phần Thoán từ · Tượng từ · Hào từ, cùng chú giải của
**Trình Di** (1033–1107) và **Chu Hy** (1130–1200): có tuổi đời nhiều thế kỷ, thuộc
**phạm vi công cộng**. Không ai sở hữu, ai cũng dùng được.

### 2. Bản dịch Ngô Tất Tố: phạm vi công cộng, nhưng phải ghi công

Phần Hán-Việt và nghĩa của 384 hào trong kho này neo theo bản dịch **_Kinh Dịch trọn bộ_**
của **Ngô Tất Tố** (1893 – 20/4/1954).

Theo Luật Sở hữu trí tuệ Việt Nam, quyền tài sản đối với tác phẩm được bảo hộ **suốt cuộc
đời tác giả và 50 năm sau khi tác giả mất**. Cụ Tố mất năm 1954, nên quyền tài sản đã hết
hạn từ **ngày 1/1/2005**, và bản dịch nay thuộc **phạm vi công cộng** tại Việt Nam.

**Nhưng quyền nhân thân, tức quyền được đứng tên tác giả, là vĩnh viễn.** Ghi công cụ Ngô Tất
Tố **không phải phép lịch sự, mà là nghĩa vụ pháp lý và đạo lý**. Ai dùng lại phần này,
xin giữ nguyên việc ghi công đó.

> Lưu ý: các **bản in hiện đại** của bản dịch này có thể kèm lời tựa, chú thích, minh hoạ
> hoặc biên tập **mới**. Những phần thêm vào đó **vẫn có bản quyền riêng của nhà xuất bản
> hoặc người biên soạn**, và **không** nằm trong phạm vi công cộng. Kho này chỉ neo theo
> phần bản dịch của cụ Tố.

### 3. Diễn giải hiện đại: **CC BY 4.0**

Phần **do chủ dự án viết** (diễn giải hiện đại của 64 quẻ, ngắn và sâu; phần "dịch tượng
cổ sang ngôn ngữ hôm nay" của 384 hào; các bài viết trong app; bản dịch tiếng Anh) được
phát hành theo giấy phép:

**[Creative Commons Ghi công 4.0 Quốc tế (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.vi)**

Nghĩa là bạn **được tự do**:

- **Chia sẻ**: sao chép và phát hành lại bằng bất kỳ phương tiện nào;
- **Chỉnh sửa**: pha trộn, biến đổi, xây dựng tiếp;
- kể cả **cho mục đích thương mại**.

Với **một điều kiện duy nhất**:

- **Ghi công**: nêu tên tác giả, dẫn link về kho này và về giấy phép, và **nói rõ nếu bạn
  có sửa đổi**. Bạn được làm điều đó theo cách hợp lý, nhưng không được ngụ ý rằng chủ dự
  án tán thành bạn hay cách bạn dùng.

Ghi công đề xuất:

> Diễn giải hiện đại từ **Dịch Số** của *Đọc sách và thảo luận*, CC BY 4.0
> https://github.com/docsachvathaoluan/dich-so

Toàn văn giấy phép: https://creativecommons.org/licenses/by/4.0/legalcode.vi

### 4. Điều nên biết trước khi dùng lại

Diễn giải hiện đại ở lớp 3 là **cách hiểu của một người đọc**, không phải phán quyết học
thuật. Chúng sinh ra từ việc đọc trọn bộ bản dịch của cụ Tố và đối chiếu với số học và nhị
phân. Dự án **cố ý tách bạch** đâu là **số kiểm được** (Hà Đồ 55, Lạc Thư 45, ma phương
15, 64 mã 0–63) với đâu là **diễn giải truyền thống có dị bản**. Nếu bạn dùng lại, xin giữ
sự tách bạch đó; đừng biến diễn giải thành định lý.

---

## English

This repository mixes several layers of text with **different legal status**. Spelling each
one out is part of the project's principle: if you ask others to cite their sources, you cite
yours first.

### 1. The ancient canon: public domain

The classical text of the *I Ching* (*Zhou Yi*), its Judgement, Image and Line texts, along
with the commentaries of **Cheng Yi** (1033–1107) and **Zhu Xi** (1130–1200), are centuries
old and in the **public domain**. Nobody owns them.

### 2. Ngô Tất Tố's translation: public domain, attribution still required

The Sino-Vietnamese readings and glosses of the 384 lines in this repository are anchored to
the Vietnamese translation **_Kinh Dịch trọn bộ_** by **Ngô Tất Tố** (1893 – 20 April 1954).

Under Vietnamese intellectual property law, the economic rights in a work last for the
**life of the author plus 50 years**. Ngô Tất Tố died in 1954, so those rights expired on
**1 January 2005** and the translation is now in the **public domain** in Vietnam.

**However, moral rights, the right to be named as the author, are perpetual.** Crediting
Ngô Tất Tố is **a legal and ethical obligation, not a courtesy**. If you reuse this material,
please carry that credit forward.

> Note: **modern printed editions** of this translation may add new prefaces, annotations,
> illustrations or editorial matter. Those additions **remain under their publisher's or
> editor's copyright** and are **not** in the public domain. This repository anchors only to
> Ngô Tất Tố's translation itself.

### 3. The modern interpretations: **CC BY 4.0**

The material **written by the project author** (the modern interpretations of the 64
hexagrams, short and deep; the "ancient image rendered into today's language" readings of
the 384 lines; the app's prose; and the English translation) is released under:

**[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)**

You are **free to**:

- **Share**: copy and redistribute in any medium or format;
- **Adapt**: remix, transform, and build upon the material;
- for **any purpose, even commercially**.

Under **one condition**:

- **Attribution**: give appropriate credit, link to this repository and to the licence, and
  **indicate if changes were made**. You may do so in any reasonable manner, but not in any
  way that suggests the project author endorses you or your use.

Suggested attribution:

> Modern interpretations from **Dịch Số** by *Đọc sách và thảo luận*, CC BY 4.0
> https://github.com/docsachvathaoluan/dich-so

Full licence text: https://creativecommons.org/licenses/by/4.0/legalcode

### 4. Please read before reusing

The modern interpretations in layer 3 are **one reader's understanding**, not scholarly
rulings. They come from reading Ngô Tất Tố's translation in full and testing it against
binary and number theory. The project deliberately **keeps apart** what is
**arithmetically checkable** (Hetu 55, Luoshu 45, magic constant 15, the 64 codes covering
0–63) from what is **traditional interpretation with variant readings**. If you reuse this,
please preserve that separation. Do not turn an interpretation into a theorem.
