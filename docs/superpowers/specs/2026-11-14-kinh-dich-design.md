# Kinh Dịch: gieo xu, tra lời kinh, AI luận (thiết kế)

Ngày: 2026-11-14 · Nhánh: làm tiếp trên `feat/prompt-v3-hoi-nguoi-dung` (dùng lại AskCard, `hoi_nguoi_dung`, hạn mức lượt).

## 1. Mục đích

Thêm tính năng **mới, tách riêng khỏi lá số Tử Vi**: người dùng gõ một câu hỏi, gieo 3 đồng xu 6 lần, ra quẻ chính, hào động và quẻ biến. App tra lời kinh có sẵn, rồi AI luận **chi tiết** cho đúng câu hỏi đó.

Người dùng muốn (lời của họ):
- "cái kinh dịch này phải chi tiết"
- thiếu hoặc sai ngữ cảnh thì AI **hỏi lại trước khi luận**, bằng thẻ hỏi kiểu Claude Code (các ý hỏi + tự nhập), khung chat vẫn gõ được
- prompt gồm câu hỏi, quẻ đã tính sẵn và lời kinh vừa tra; **"không được tự đổi quẻ hay tự chế lời kinh"**
- memory phải chuẩn. Một tài khoản xem nhiều lá số nên **không lấy memory bên Tử Vi**: "làm nhánh memory mới thôi"

## 2. Mục tiêu, ngoài phạm vi, phản mục tiêu

**Mục tiêu (v1)**
- **Làm rõ câu hỏi TRƯỚC khi gieo** (người dùng chốt 2026-11-14: "hỏi lại trước khi gieo nhé"). AI đọc câu hỏi, thiếu ý quan trọng (việc gì, cho ai, lựa chọn đang cân nhắc, khung thời gian) thì hiện AskCard; đủ rồi (hoặc người dùng bỏ qua) mới mở nút gieo.
- Trang `/kinh-dich`. Gõ câu hỏi, gieo xu theo một trong hai cách: bấm từng hào (6 lần) hoặc gieo tự động. Sau đó hiện quẻ chính → quẻ biến, có đánh dấu hào động, kèm lời kinh.
- AI luận chi tiết, có thể hỏi lại bằng AskCard trước khi luận, rồi hỏi tiếp trong cùng hội thoại.
- Memory riêng của Kinh Dịch: những gì người dùng đã kể và đã hỏi ở các lần gieo trước của **chính tài khoản đó**.
- Danh sách các quẻ đã gieo. Mở lại một quẻ thì nạp lại hội thoại của nó.

**Ngoài phạm vi (v1):** lục hào nạp giáp, mai hoa dịch số, kết hợp với lá số Tử Vi, chia sẻ quẻ, bản tiếng Anh. Lục hào và mai hoa sẽ làm sau trên cùng nền dữ liệu.

**Phản mục tiêu** (đạt thì vẫn tính là hỏng):
- AI đổi quẻ, đổi hào động hoặc bịa lời kinh không có trong dữ liệu.
- Memory lẫn câu của người khác: tài khoản khác, hoặc lời kể bên Tử Vi về lá số của người khác.
- Gắn phần diễn giải hiện đại của dich-so vào tên Ngô Tất Tố, hoặc làm mất ghi công.

## 3. Ràng buộc

- Stack sẵn có: Next.js 16 App Router (đọc `node_modules/next/dist/docs` trước khi viết code đặc thù Next), React 19, TS, Neon qua ChatStore port, OpenRouter qua `streamChatResponse`.
- Phải đăng nhập (`callerOf`). **Một quẻ = 1 lượt**: trừ 1 lượt khi gửi câu hỏi mở lần gieo; các lượt làm rõ trước khi gieo (tối đa 4 lượt AI) và bài luận đầu tiên sau khi gieo miễn phí. Mỗi câu hỏi tiếp sau bài luận trừ 1 lượt; trả lời thẻ hỏi thì miễn phí theo luật v3 (`answering:true` + lượt trước `asked`).
- **Dữ liệu và giấy phép**, port từ `docsachvathaoluan/dich-so`:
  - `textHV` + `gloss` của 384 hào: neo theo bản dịch Ngô Tất Tố, phạm vi công cộng, **bắt buộc ghi công**.
  - `judgmentClassic` / `imageClassic` (Thoán, Đại Tượng): nguyên văn kèm tóm ý của dự án dich-so.
  - `modern` / `modernShort`: CC BY 4.0, ghi công dự án dich-so (link repo + giấy phép), **không** gắn tên Ngô Tất Tố.
  - Không dùng mã hay dữ liệu từ repo AGPL hoặc repo không có giấy phép.
- AGENTS.md: test, log và fixture chỉ dùng dữ liệu giả, không có câu hỏi hay hội thoại thật.
- Không đụng DB thật. Migration chỉ chạy khi người dùng tự chạy `npm run db:migrate`.

## 4. Cách làm (Approaches)

- **A. Dùng lại khung chat sẵn có (đã chọn).** Route riêng `/api/kinh-dich` dùng chung `streamChatResponse` + `askUser`, AskCard, hạn mức lượt, bảng `conversations`/`messages`/`ai_requests` với kind mới `'kinhdich'`. Mỗi lần gieo là một hội thoại. Ít việc, mọi thứ đã được kiểm chứng ở v3.
- **B. Bảng `casts` + luồng chat riêng.** Tách bạch hơn nhưng phải viết lại lưu trữ, hạn mức và thẻ hỏi. Người dùng không thấy khác biệt. Không chọn.

Người dùng chọn **A**.

## 5. Thiết kế

### 5.1 Lõi thuần `lib/kinh-dich/`, không phụ thuộc server

- **Gieo:** mỗi hào là 3 đồng xu, mặt ngửa = 3, mặt sấp = 2, tổng 6/7/8/9:
  - 6 = âm già (động, biến dương)
  - 7 = dương trẻ
  - 8 = âm trẻ
  - 9 = dương già (động, biến âm)
  - Gieo từ hào 1 (dưới) lên hào 6. Nguồn ngẫu nhiên là `crypto.getRandomValues`, bơm vào được để test.
- **Tính quẻ:** từ 6 giá trị hào ra:
  - quẻ chính: số thứ tự Văn Vương, tên Hán-Việt, quẻ đơn trên/dưới;
  - danh sách hào động;
  - quẻ biến (không có nếu không có hào động).
- **Trọng tâm luận** theo số hào động (quy tắc Chu Hy, tính bằng code để AI khỏi tự chọn):
  - 0 hào động: lời Thoán quẻ chính.
  - 1 hào động: hào từ của hào đó.
  - 2 hào động: hào từ của hai hào, hào trên làm chủ.
  - 3 hào động: Thoán của quẻ chính và quẻ biến.
  - 4 hào động: hai hào **tĩnh** của quẻ biến, hào dưới làm chủ.
  - 5 hào động: hào tĩnh duy nhất của quẻ biến.
  - 6 hào động: Càn/Khôn dùng Dụng Cửu/Dụng Lục, quẻ khác dùng Thoán quẻ biến.
- **Server không tin dữ liệu tính sẵn từ client:** client chỉ gửi 6 giá trị hào (6–9), server kiểm tra rồi tự tính lại toàn bộ.

### 5.2 Dữ liệu `lib/kinh-dich/data/`

- `hexagrams.json` gồm 64 quẻ, sinh một lần bằng script `scripts/kinh-dich/port-dich-so.mjs` từ bản clone dich-so; ghi commit nguồn trong file. Mỗi quẻ có:
  - số Văn Vương, tên, quẻ đơn trên/dưới, 6 bit;
  - Thoán (`judgmentClassic`), Đại Tượng (`imageClassic`);
  - 6 hào `{textHV, gloss, modern}`;
  - Dụng Cửu/Lục nếu có;
  - `modernShort`.
- `NOTICE.md` nằm cạnh dữ liệu: ghi rõ ba lớp nguồn và giấy phép như mục 3, chép kèm `LICENSE-CONTENT.md` của dich-so.
- Trên UI, dưới phần lời kinh có dòng nhỏ: "Hào từ theo bản dịch *Kinh Dịch trọn bộ* của Ngô Tất Tố · diễn giải hiện đại: dự án dich-so (CC BY 4.0)".

### 5.3 Lưu trữ: migration `004_kinh_dich.sql`

- `conversations.kind` cho thêm `'kinhdich'`.
- `chart_id` được phép null, **chỉ với** kind `kinhdich`: check `(kind = 'kinhdich') = (chart_id is null)`.
- Thêm cột `meta jsonb` để lưu dữ liệu gieo của hội thoại: `{question, lines:[6 số], castAt}`.
- `thread_key` = mã lần gieo (ngẫu nhiên, ≤100 ký tự). Ràng buộc định danh hiện có vẫn đúng.
- ChatStore có thêm các hàm riêng cho Kinh Dịch, theo chủ tài khoản `userId`, cài đủ ở neon, memory và disabled:
  - tạo lần gieo
  - liệt kê các lần gieo (mới nhất trước)
  - nạp một lần gieo kèm tin nhắn
  - nạp memory
  - ghi lượt chat
  - trạng thái tin trả lời cuối
- Tin nhắn và log AI dùng chung bảng `messages`/`ai_requests`, với `route='kinh-dich'` và `prompt_version='kd1'`.

### 5.4 Nhánh memory mới

- **Chỉ lấy** từ hội thoại kind `kinhdich` của đúng chủ tài khoản. **Không bao giờ** đọc kind `interpret`/`heming`.
- Gồm hai loại, xếp cũ → mới, có ngày:
  1. Mỗi lần gieo trước: ngày, câu hỏi, tên quẻ chính → quẻ biến. Đây là dữ kiện thật đã lưu, không phải lời AI.
  2. Những câu người dùng tự gõ trong các lần gieo đó, kể cả câu trả lời thẻ hỏi. Không lấy câu trả lời của AI, không lấy tin ẩn.
- Bỏ lần gieo hiện tại khỏi memory, vì phần đó đã nằm trong hội thoại.
- Giới hạn giống prior-notes: tối đa 30 mục, 4000 ký tự, 500 ký tự mỗi mục. Store lỗi hoặc chậm quá 1,5 giây thì trả rỗng, không chặn chat.
- Prompt ghi rõ: đây là lời người dùng tự kể, có thể đã cũ. Không suy diễn thêm. Nếu memory mâu thuẫn với câu hỏi mới hoặc không chắc còn đúng thì hỏi lại bằng thẻ, đừng tự đoán.

### 5.4b Hai giai đoạn của một lần gieo

1. **Làm rõ (chưa gieo):** prompt `kd1-prepare` — chỉ kiểm tra câu hỏi, KHÔNG luận, không đoán quẻ. Thiếu ý quan trọng → `hoi_nguoi_dung` (tối đa 3 câu, mỗi câu 2–4 lựa chọn). Đủ, hoặc người dùng bỏ qua, hoặc đã hỏi liên tiếp `MAX_CONSECUTIVE_ASKS` lần → trả lời một đoạn ngắn: "Câu hỏi đã rõ: … Hãy tĩnh tâm nghĩ về câu hỏi rồi gieo." Lượt AI không phải thẻ hỏi = sẵn sàng gieo.
2. **Gieo + luận:** client gửi 6 giá trị hào; server lưu (chỉ một lần cho mỗi lần gieo) rồi stream bài luận với prompt `kd1`, kèm toàn bộ đoạn làm rõ làm lịch sử.

### 5.5 Prompt `kd1` (`lib/kinh-dich/prompt.ts`)

Prompt riêng, không thuộc bộ v1–v3 của Tử Vi. System prompt gồm:
- Vai trò và cách luận chi tiết theo cấu trúc:
  - trả lời thẳng câu hỏi trước;
  - ý quẻ chính → hào động/trọng tâm → quẻ biến (xu hướng);
  - lời khuyên cụ thể, mốc nên làm/tránh;
  - kết luận ngắn.
- Khối JSON dữ kiện quẻ:
  - câu hỏi
  - 6 hào kèm giá trị
  - quẻ chính, hào động, quẻ biến
  - trọng tâm (5.1)
  - lời kinh liên quan: Thoán, Tượng, hào từ của các hào trọng tâm; mỗi đoạn ghi nguồn
- Luật cứng:
  - "không được tự đổi quẻ hay tự chế lời kinh";
  - chỉ trích lời kinh có trong khối dữ kiện, ghi rõ đâu là lời kinh theo bản dịch Ngô Tất Tố, đâu là diễn giải;
  - không gieo lại hay gợi ý quẻ khác;
  - không phán chắc chắn chuyện sinh tử, bệnh tật, pháp lý (giữ đúng luật an toàn đang dùng bên Tử Vi).
- Luật hỏi lại, giống tinh thần v3:
  - dùng `hoi_nguoi_dung` **trước khi viết**, khi câu hỏi mơ hồ (không rõ việc gì, của ai, mốc thời gian) hoặc memory mâu thuẫn;
  - không hỏi ở cuối bài;
  - tối đa `MAX_CONSECUTIVE_ASKS` lượt hỏi liên tiếp.
- Khối memory (5.4).

AI không có tool tra cứu: mọi dữ kiện đã tính sẵn, chỉ bật `askUser`.

### 5.6 API

- `POST /api/kinh-dich` body `{castId?, messages, lines?, answering?}`; giai đoạn do **trạng thái đã lưu** quyết định:
  - Không có `castId`: tạo lần gieo mới (server sinh mã, trả ở header `X-Cast-Id`), câu hỏi = tin user đầu, trừ 1 lượt, chạy giai đoạn làm rõ.
  - Có `castId`, chưa gieo, không có `lines`: tiếp giai đoạn làm rõ (miễn phí, tối đa 4 lượt AI, quá → 409 "hãy gieo").
  - Có `castId`, chưa gieo, có `lines`: lưu quẻ (nguyên tử, một lần) rồi luận — miễn phí.
  - Có `castId`, đã gieo: hỏi tiếp; `lines` trong body bị bỏ qua; quẻ luôn đọc từ store.
  - Store tắt (không có DB): không có trạng thái → giai đoạn suy từ body (có `lines` = luận), mỗi lượt qua `chargeChat`, không memory, không lưu.
  - SSE giống `/api/interpret` (`delta`, `status`, `ask`, `error`, `[DONE]`). Header `X-Chat-Quota`.
- `GET /api/kinh-dich`: danh sách lần gieo của tài khoản.
- `GET /api/kinh-dich?castId=…`: một lần gieo kèm tin nhắn.
- Không đăng nhập → 401. Sai `lines`, câu hỏi rỗng hoặc dài quá 500 ký tự → 400.

### 5.7 Giao diện `/kinh-dich`

```
┌ Kinh Dịch ─────────────────────── [Quẻ đã gieo ▾] ┐
│ Bạn muốn hỏi điều gì?                              │
│ [ Có nên nhận lời mời làm việc ở công ty mới? ]    │
│ Tâm niệm câu hỏi rồi gieo.                         │
│  (●)(○)(●)   [Gieo hào 3/6]  [Gieo tự động]        │
│  ━━━ ━━━   hào 2  8                                │
│  ━━━━━━━ ○ hào 1  9 (động)                         │
├────────────────────────────────────────────────────┤
│  ䷀ Càn (1)  ──hào 1 động──▶  ䷫ Cấu (44)            │
│  Thoán · Tượng · Hào từ hào 1        [mở/thu]      │
│  Hào từ theo bản dịch Ngô Tất Tố · diễn giải: dich-so │
├────────────────────────────────────────────────────┤
│  [AskCard nếu AI hỏi lại] / bài luận stream        │
│  [ khung chat hỏi tiếp…                    Gửi ]   │
└────────────────────────────────────────────────────┘
```

- Gửi câu hỏi → AI làm rõ (AskCard nếu thiếu) → hiện "Câu hỏi đã rõ…" → nút gieo mới bật. Gieo đủ 6 hào thì tự gửi lượt luận.
- Các hào hiện dần từ dưới lên, có hiệu ứng xu lật ngắn (tôn trọng `prefers-reduced-motion`).
- Dùng lại AskCard và các biến màu `--t-*` của app. Thêm link "Kinh Dịch" vào chỗ điều hướng hiện có.

### 5.8 Test

Theo mẫu `scripts/regression/*.test.ts`, đăng ký vào `npm test`:
- Lõi:
  - tổng xu → giá trị hào;
  - 64 mẫu bit ra 64 quẻ khác nhau;
  - quẻ biến đúng, bộ đầy đủ bảy trường hợp trọng tâm;
  - kiểm tra `lines` không hợp lệ.
- Dữ liệu: đủ 64 quẻ × 6 hào, chữ không rỗng, có `NOTICE.md`, có dòng ghi công.
- Prompt:
  - có luật "không được tự đổi quẻ hay tự chế lời kinh";
  - có đúng lời kinh của hào trọng tâm;
  - phần `modern` không bị gắn tên Ngô Tất Tố.
- Memory (memory store):
  - không lẫn kind `interpret`;
  - không lẫn tài khoản khác;
  - bỏ lần gieo hiện tại;
  - đúng giới hạn.
- Route:
  - 401, 400;
  - lượt đầu trừ lượt;
  - trả lời thẻ miễn phí;
  - `lines` trong body lượt sau bị bỏ qua.
- Chạy `npm run harness` xanh.

## 6. Việc để người dựng tự quyết

- Mã lần gieo, ký hiệu quẻ Unicode, chi tiết hiệu ứng xu.
- Tên chính xác của các hàm store, vị trí link điều hướng.
- Cách tách component (`CoinCaster`, `HexagramView`, `KinhDichChat`…).
- Danh sách "Quẻ đã gieo" là dropdown hay cột bên.

## 7. Các quyết định của mình (cần người dùng xem lại)

- Memory gồm cả **danh sách quẻ đã gieo** (câu hỏi + tên quẻ), không chỉ lời kể, để AI biết "lần trước hỏi việc này ra quẻ gì".
- Gieo xu chạy ở trình duyệt, server tính lại quẻ từ 6 giá trị hào. Người dùng gieo cho chính mình nên không cần chống gian lận.
- Gieo lại cùng câu hỏi vẫn được, mỗi lần là một quẻ mới. Không chặn, nhưng hiện một dòng nhắc "gieo lại nhiều lần cho một việc thường không nên".
- Một quẻ = 1 lượt (gồm làm rõ + bài luận đầu); hỏi tiếp mỗi câu 1 lượt. Lý do: làm rõ miễn phí hoàn toàn thì dễ bị lạm dụng, còn trừ cả làm rõ lẫn bài luận thì người dùng thiệt vì bị hỏi lại.
