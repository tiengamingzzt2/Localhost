# TOEIC Studio

Ứng dụng thi thử / luyện tập TOEIC tiếng Việt chạy hoàn toàn trên localhost. Node.js phục vụ giao diện, API và lưu dữ liệu JSON; không cần cài thư viện, npm, cơ sở dữ liệu hoặc khóa API.

## Chạy trên Windows

Yêu cầu **Node.js 22 trở lên**.

```powershell
cd 'D:\BTVN\Đề bài\Toeic'
node server.mjs
```

Mở **http://localhost:3000** (hoặc **http://127.0.0.1:3000**) bằng Chrome / Edge. Chọn **Trải nghiệm với tài khoản demo**, hoặc đăng ký tài khoản riêng. Tài khoản demo được tạo riêng mỗi lần bấm; muốn giữ tài khoản để đăng nhập về sau, hãy đăng ký bằng email và mật khẩu.

Dừng bằng `Ctrl+C`. Muốn đổi cổng:

```powershell
$env:PORT = '3001'
node server.mjs
```

Có thể chạy `node --watch server.mjs` khi phát triển. Nếu có npm, `npm start`, `npm run dev`, `npm test` cũng hoạt động.

## Chức năng

- Đăng ký, đăng nhập, đăng xuất; mật khẩu băm bằng scrypt, phiên đăng nhập qua cookie HttpOnly.
- Trang tổng quan, mục tiêu điểm cá nhân, thư viện có tìm kiếm / bộ lọc, bài được giao, lịch sử và thống kê từng Part.
- Đề TOEIC Foundation 01 gồm **20 câu đủ 7 Part**; Reading Focus gồm 12 câu; Listening Everyday gồm 8 câu. Bài được giao sử dụng lại bộ câu minh họa.
- Thi thử: 30 phút cho đề tổng hợp, gồm 10 phút Listening và 20 phút Reading. Reading khóa trong thời gian Listening; Listening khóa sau 10 phút. Hai đề kỹ năng có thời lượng riêng.
- Luyện tập: không giới hạn thời gian, chuyển câu tự do, được phát lại audio.
- Kiểm tra audio, xác nhận nghe rõ và đồng ý quy tắc trước khi bắt đầu đề có phần nghe.
- Đánh dấu câu hỏi, bảng điều hướng, tự lưu đáp án sau mỗi lựa chọn, tiếp tục lượt đang làm từ trang tổng quan / lịch sử.
- Mất kết nối: giữ bản nháp trong localStorage, đồng bộ lại khi có kết nối hoặc bấm Đồng bộ lại. Nếu Listening đã hết giờ, đáp án nghe chưa đến máy chủ sẽ không được chấp nhận; giao diện thông báo và giữ đáp án đã được máy chủ chấp nhận. Thời gian thi vẫn tiếp tục khi mất mạng / đóng tab.
- Nộp chủ động có thống kê câu bỏ trống và xác nhận. Hết giờ khóa đáp án theo giờ máy chủ; trình duyệt tự yêu cầu hoàn tất. Nếu trang đang đóng, máy chủ hoàn tất lượt ở lần truy cập tiếp theo với thời điểm kết thúc bằng hạn chót.
- Nộp lặp không tạo kết quả mới. Chấm các đáp án hợp lệ mà máy chủ đã nhận.
- Kết quả đúng/sai/bỏ trống, tỷ lệ chính xác, Listening / Reading / từng Part; chữa bài, giải thích, nghe lại, transcript, lọc câu sai và luyện lại nhóm câu sai / bỏ trống.
- Bài được giao mở chữa bài **5 phút sau khi nộp ở chế độ thi thử**; luyện tập mở ngay.
- Bố cục thích ứng desktop / tablet / điện thoại.

## Dữ liệu và phạm vi bản cơ bản

Dữ liệu tài khoản, phiên và bài làm tự lưu tại `data/database.json` (được bỏ qua trong Git). Khởi động lại máy chủ vẫn giữ dữ liệu. Không chạy nhiều tiến trình dùng cùng thư mục dữ liệu. Khi triển khai thực tế, thay tệp JSON bằng cơ sở dữ liệu giao dịch như SQLite / PostgreSQL.

**Nội dung và hình minh họa được tự soạn**, không phải bộ đề chính thức ETS. Bộ đề chỉ có 20 câu để kiểm tra toàn bộ luồng. Chưa có ngân hàng đề 200 câu, trình quản trị / giáo viên, phân lớp hoặc cơ chế giao đề theo người dùng. Bài được giao và quyền truy cập đề đang là cấu hình mẫu chung cho các tài khoản.

Audio dùng `speechSynthesis` (giọng đọc tiếng Anh của trình duyệt / hệ điều hành), không phải bản thu TOEIC; cần máy có giọng đọc tiếng Anh khả dụng. Kiểm tra tai nghe trước khi thi. Một số giọng có thể cần mạng. Muốn sử dụng đề thi thật, thay bằng tệp audio và câu hỏi được cấp quyền sử dụng.

Chỉ hiển thị tỷ lệ đúng; **không quy đổi điểm 10–990** khi chưa có bảng quy đổi phù hợp. Máy chủ chỉ lắng nghe `127.0.0.1`; bản này dành cho thử nghiệm cá nhân trên localhost.

## Cấu trúc

```text
server.mjs              HTTP server, đăng nhập, API, thời gian, chấm bài
questions.mjs           Câu hỏi, đáp án, lời giải và cấu hình đề
public/index.html       Trang khởi chạy
public/app.js           Giao diện và luồng tương tác
public/style.css        Thiết kế giao diện và responsive
tests/workflow.test.mjs Kiểm thử tích hợp API
data/database.json      Tự tạo khi chạy, không đưa vào Git
```

Mỗi đề được cấu hình trong `exams` tại `questions.mjs`. Sửa `minutes`, `listeningMinutes`, `questionIds`, `access`, `releaseDelay` để thay đổi thời lượng, quyền làm và thời điểm mở chữa bài. Đáp án / giải thích / transcript được máy chủ loại khỏi API trước thời điểm mở chữa bài.

## Kiểm thử

```powershell
node --test tests/workflow.test.mjs
```

Kiểm thử sử dụng thư mục dữ liệu tạm riêng, không tác động dữ liệu đang dùng. Bao gồm phân tách tài khoản, băm mật khẩu, lưu và khôi phục bài, kiểm tra đáp án, khóa thời gian hai phần, tự hết giờ, nộp lặp, chờ mở chữa bài và luyện lại câu sai.
