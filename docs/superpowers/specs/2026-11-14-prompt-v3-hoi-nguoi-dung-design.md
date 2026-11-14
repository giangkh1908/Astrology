# Prompt v3: AI hỏi lại người dùng + luận 3 tháng tới

Ngày: 2026-11-14 · Phạm vi: chat luận giải `/chart` (InsightPanel + `/api/interpret`). Không đụng `/heming`. Kinh Dịch làm sau, dùng lại phần hỏi lại này.

## Vì sao

1. **Câu hỏi lại bị chôn ở cuối bài.** Prompt hiện tại (`lib/prompts/shared.ts:175`) bắt AI "luôn trả lời phần có thể kết luận trước", rồi mới hỏi lại 1 câu ở cuối. Người dùng không đọc tới cuối, nên AI không bao giờ có đủ bối cảnh và bài luận chung chung.
2. **Luận quá xa.** Prompt kéo AI luận lá số gốc (cả đời) + đại hạn (10 năm), năm nay chỉ "nêu ngắn cuối bài" (`shared.ts:223`), hỏi "bao giờ" thì quét 14 năm. Người dùng muốn câu trả lời về **tương lai gần**.

## Mục tiêu

- AI thiếu bối cảnh làm thay đổi hẳn cách luận thì **hỏi trước, luận sau**, bằng thẻ câu hỏi kiểu AskUserQuestion của Claude Code.
- Mọi câu trả lời mặc định nói về **3 tháng âm lịch tới**, chia từng tháng; người dùng nhảy khung **3 tháng một lần** (◀ ▶).
- Đóng gói thành **prompt v3**, chọn được ở `/admin` như v1/v2; v1/v2 giữ nguyên hành vi.

## Không làm (non-goals)

- Không làm cho `/heming`.
- Không làm Kinh Dịch trong đợt này.
- Không giữ lượt agent chạy dở để resume (đã loại, xem Approaches).

## Anti-goals (làm xong mà thế này là hỏng)

- AI hỏi ở mọi lượt, hoặc hỏi lại điều người dùng đã kể (trong chat hoặc lời kể ở mục khác).
- Người dùng bị trừ lượt khi trả lời câu AI hỏi.
- Người dùng bị kẹt: không trả lời thì không đọc được gì.
- Bài luận vẫn mở bằng đoạn dài về lá số gốc / đại hạn.

## Approaches

| | Cách | Đánh đổi | |
|---|---|---|---|
| 1 | Tool `hoi_nguoi_dung` **kết thúc lượt**; câu trả lời là lượt mới | Hợp kiến trúc stateless hiện tại (client gửi cả lịch sử); ít rủi ro | **Đã chọn** |
| 2 | Giữ lượt, lưu trạng thái agent vào DB rồi resume | Đúng tinh thần tool hơn nhưng phải lưu state, xử lý bỏ dở, giới hạn thời gian Vercel | Loại |
| 3 | Dặn AI in khối JSON câu hỏi trong text | Dễ nhất nhưng model flash in sai định dạng | Loại |

## Thiết kế

### 1. Tool `hoi_nguoi_dung` (chỉ gửi cho model khi version = v3)

Tham số (JSON schema), mô phỏng AskUserQuestion:

```ts
{
  loi_dan: string,            // 1 câu dẫn ngắn, ví dụ "Để luận đúng chuyện của bạn, cho mình hỏi thêm:"
  cau_hoi: Array<{            // 1–3 câu
    nhan: string,             // nhãn tab ≤ 12 ký tự, ví dụ "Hôn nhân"
    noi_dung: string,         // câu hỏi đầy đủ, kết thúc bằng "?"
    lua_chon: Array<{ tieu_de: string, giai_thich?: string }>, // 2–4 lựa chọn, lựa chọn khuyên dùng đặt đầu
    chon_nhieu?: boolean,
  }>
}
```

Không khai báo "Tự nhập": UI luôn thêm.

**Thứ tự:** AI hỏi **TRƯỚC khi luận**. Khi gọi `hoi_nguoi_dung`, AI chỉ viết đúng 1 câu dẫn, **chưa viết bài luận nào**. Server tạm dừng (đóng request hiện tại) để chờ người dùng trả lời; bài luận chỉ được viết ở lượt sau, khi đã có câu trả lời.

**Hành vi trong `streamChatResponse`:** khi một vòng có tool call `hoi_nguoi_dung`:
- Validate + cắt về giới hạn (≤3 câu, 2–4 lựa chọn, độ dài chuỗi). Sai định dạng quá mức thì bỏ tool call này, trả cho model kết quả lỗi để nó luận tiếp như bình thường.
- Chữ model viết trong cùng vòng với tool call này **không được phát ra** (cơ chế giữ lời dạo đầu sẵn có đã bỏ phần đầu; v3 bỏ toàn bộ chữ của vòng có `hoi_nguoi_dung`). Người dùng chỉ thấy `loi_dan` + thẻ. Nếu model đã lỡ phát >200 ký tự bài luận rồi mới gọi tool thì bỏ tool call đó, coi như lượt trả lời bình thường (ghi log để theo dõi tần suất).
- Hợp lệ: **không chạy thêm vòng nào**, bỏ các tool call khác cùng vòng, gửi SSE `data: {"ask": {...}}` rồi `[DONE]`.
- Text của lượt (để lưu DB và dựng lại lịch sử) = `loi_dan` + một **khối đánh dấu** chứa JSON câu hỏi, ví dụ `\n\n<!--ask:{...}-->`. Client nhận ra khối này khi nạp lịch sử để vẽ lại thẻ (đã trả lời thì vẽ dạng thu gọn, chỉ đọc).
- Khi gửi lịch sử lên model ở lượt sau, server đổi khối đánh dấu thành văn bản thường (`Mình đã hỏi: 1) … Lựa chọn: …`) để model hiểu ngữ cảnh.
- `TurnResult` thêm cờ `asked: true`; DB lưu `messages.status = 'asked'` cho tin assistant đó (cột `status` là text, không cần migration).

### 2. Câu trả lời của người dùng = lượt mới

- Client gửi một tin `user` bình thường, nội dung dạng văn bản đọc được:
  `Trả lời câu hỏi:\n- Hôn nhân: Đã kết hôn\n- Con cái: Chưa có, đang dự định` (tự nhập thì ghi nguyên văn; bỏ qua câu nào thì ghi "bỏ qua").
- Kèm cờ `answering: true` trong body.
- **Không trừ lượt** khi: `answering: true` **và** tin assistant cuối cùng đã lưu của thread này trong DB có `status = 'asked'` và chưa được trả lời. Ngược lại trừ lượt như thường. Store tắt thì trừ như thường.
- Người dùng gõ thẳng vào khung chat thay vì dùng thẻ: là tin nhắn thường, trừ lượt, AI tự hiểu đó là câu trả lời.
- Nút **"Bỏ qua, cứ luận đi"**: gửi `answering: true` với nội dung `Bỏ qua câu hỏi, hãy luận theo dữ kiện hiện có.` (không trừ lượt).

**Chống hỏi mãi:** đếm số tin `asked` liên tiếp ở cuối lịch sử thread (từ lần trả lời đầy đủ gần nhất). Đã 2 lần thì lượt sau **không gửi tool `hoi_nguoi_dung`** cho model.

### 3. Prompt v3

Tạo `lib/prompts/v3/index.ts`, thêm vào `PROMPT_VERSIONS` / `SETS` với nhãn kiểu "v3 – hỏi lại trước, luận 3 tháng tới". Dựa trên v2 (không nêu tên sao, căn cứ theo cung), thay các luật sau. Phần dùng chung của `buildInterpretationPrompt` cần nhận tham số để v3 thay đúng dòng 175 và khối "Cách làm việc với công cụ" mà không đổi output của v1/v2 (kiểm bằng harness hiện có).

**Luật hỏi lại (thay dòng 175):**
- Trước khi viết, tự xét: hoàn cảnh nào chưa biết mà **làm thay đổi hẳn kết luận** (đã lập gia đình chưa, đang đi làm hay kinh doanh, đang có người yêu không, việc cụ thể đang tính là gì…)? Nếu có và chưa có trong chat lẫn lời kể ở mục khác → gọi `hoi_nguoi_dung` **ngay, chưa viết bài luận**.
- Không hỏi điều đã biết; không hỏi chuyện chỉ làm bài hay hơn chút ít.
- Đã đủ bối cảnh → luận trọn bài, **cuối bài không đặt câu hỏi**.
- Câu hỏi mở mục tự động (người dùng chưa gõ gì) **không được hỏi lại**: luận luôn theo lá số.

**Luật thời gian (thay khối luận theo tầng):**
- Phạm vi mặc định: **khung 3 tháng âm lịch đang chọn** (xem mục 4). Trình bày **theo từng tháng**, mỗi tháng ghi kèm khoảng dương lịch, tháng nổi bật nhất nói kỹ nhất.
- Lá số gốc và đại hạn chỉ dùng làm **lý do** trong câu, không viết thành đoạn riêng, không mở bài bằng chúng.
- Người dùng tự hỏi xa ("bao giờ cưới", "năm sau") thì trả lời ngắn (được phép dùng `quet_cac_nam`, `xem_van_han`), rồi gợi ý nhảy khung tới giai đoạn đó.
- Mục **Tính cách** (`personality`) và câu hỏi về bản chất con người không có khái niệm thời gian: luận theo lá số gốc như v2. *(Quyết định của Claude, xem cuối.)*

**Câu hỏi mở mục tự động v3:** mọi topic (trừ personality), cung, tứ hóa: "Luận [chủ đề] trong 3 tháng âm lịch [khung]: từng tháng một…".

### 4. Khung 3 tháng

- `InterpretationTimeContext` thêm `window?: { lunarYear: number; startMonth: number }` (tháng âm 1–12). Mặc định: tháng âm hiện tại (giờ VN) + 2 tháng sau; qua tháng 12 thì sang năm âm sau.
- Server (v3) **tính sẵn** lưu nguyệt 3 tháng của khung bằng chính logic của tool `xem_van_han(nam, thang)` và đưa vào phần dữ kiện của prompt, để AI không phải gọi tool cho việc cơ bản (giảm độ trễ). Tháng nhuận xử lý theo đúng quy ước engine/tool hiện có.
- Client (InsightPanel, chỉ khi v3): thanh `◀ Tháng 10 – 12 âm (21/11/2026 – 16/02/2027) ▶` ở đầu khu chat của mục. Bấm ◀/▶ thì dời khung 3 tháng và gửi câu hỏi ngầm "Luận [chủ đề] cho khung tháng X–Y" trong **cùng thread**, có trừ lượt; câu trả lời cũ giữ nguyên. Lùi không quá khung hiện tại.
- Ngày dương lịch trên thanh lấy từ cùng hàm chuyển đổi âm-dương mà tool dùng (không tự đoán).

### 5. UI thẻ câu hỏi (component mới, ví dụ `components/AskCard.tsx`)

Chép cách hoạt động của AskUserQuestion:
- Thanh tab trên cùng: mỗi câu một tab (`nhan`), dấu ✔ khi đã trả lời, tab cuối "Gửi" để xem lại.
- Mỗi lần hiện một câu; lựa chọn có tiêu đề + 1 dòng giải thích; lựa chọn cuối luôn là **"Tự nhập…"**, chọn vào là gõ được tại chỗ.
- `chon_nhieu` → checkbox.
- Bàn phím: ↑↓ chọn, phím số chọn nhanh, Enter xác nhận, Tab/←→ đổi câu, Esc = bỏ qua. Điện thoại: chạm.
- Nút "Bỏ qua, cứ luận đi".
- **Khung chat bên dưới vẫn gõ được**; gõ vào đó thì thẻ chuyển trạng thái đã bỏ qua.
- Thẻ đã trả lời (khi nạp lại lịch sử) hiện thu gọn: câu hỏi + đáp án đã chọn.

### 6. Gợi ý câu hỏi sau bài luận

Không để AI tự sinh (model flash dễ in sai định dạng). Client hiện 2–3 nút gợi ý **tĩnh** theo chủ đề + tháng nổi bật của khung, ví dụ "Tháng 11 âm có nên ký hợp đồng?". Bấm = gửi như câu hỏi thường.

### 7. Version phía client

Client cần biết version đang chạy để bật thanh khung 3 tháng và thẻ hỏi lại: `/api/interpret` trả header `X-Prompt-Version`; thêm cách để biết trước lượt đầu (ví dụ một GET nhẹ, hoặc đưa vào endpoint account/quota sẵn có). Builder chọn cách gọn nhất.

## Kiểm thử

- Unit: validate/cắt tham số `hoi_nguoi_dung`; dựng/parse khối `<!--ask:-->`; đổi khối thành văn bản cho model; tính khung 3 tháng (qua năm, tháng nhuận); đếm số lần hỏi liên tiếp.
- Route: `answering` hợp lệ không trừ lượt; `answering` giả (tin cuối không phải `asked`) vẫn trừ; v1/v2 không nhận tool mới và prompt không đổi.
- Harness prompt hiện có chạy pass cho v1/v2 (output không đổi).
- Thử thật trên trình duyệt với v3: một câu thiếu bối cảnh ("Năm nay tình cảm thế nào?" khi chưa kể gì) → ra thẻ; trả lời → luận 3 tháng; ▶ → 3 tháng sau.

## Quyết định của Claude (cần anh/chị xem lại)

- Mục **Tính cách** không theo khung 3 tháng (tính cách không có thời gian).
- Mở mục tự động **không hỏi lại**, luận luôn; chỉ hỏi khi người dùng tự gõ câu hỏi.
- Bấm ◀/▶ **có trừ lượt** (là một câu luận mới); trả lời thẻ hỏi lại thì **không**.
- Tối đa **2 lần hỏi liên tiếp**, mỗi lần ≤ 3 câu.
- Gợi ý câu hỏi là nút tĩnh, không do AI sinh.
- Lưu thẻ hỏi trong nội dung tin nhắn bằng khối `<!--ask:-->` + `status='asked'`, không thêm migration.
