# Workflow đề xuất: Chuẩn bị gia hạn hợp đồng

## B1. Nhập và kiểm tra dữ liệu

Người dùng tải lên các tệp hợp đồng, nhật ký sử dụng, yêu cầu hỗ trợ, danh mục gói và chính sách gia hạn.

Hệ thống kiểm tra định dạng tệp, cấu trúc cột, kiểu dữ liệu, khóa liên kết và ngày đối chiếu.

- **Lỗi nghiêm trọng – chặn quy trình:** sai định dạng không đọc được; thiếu cột/khóa bắt buộc để ghép hồ sơ; dữ liệu khóa trùng hoặc không hợp lệ; ngày đối chiếu không thể xác định. Hiển thị thông báo lỗi màu đỏ, nêu rõ tên tệp, dòng/cột và cách khắc phục. Người dùng phải tải lại tệp đạt yêu cầu mới được tiếp tục.
- **Thiếu dữ liệu nghiệp vụ – cảnh báo, không tự điền:** thiếu nhật ký sử dụng, trạng thái ticket hoặc thông tin chính sách cho một hợp đồng. Đánh dấu trường tương ứng là **“Chưa có dữ liệu”**, nêu ảnh hưởng và cho phép tiếp tục ở trạng thái cần xác minh. Không chuyển giá trị thiếu thành 0 và không suy diễn rằng sự cố đã xử lý hay ưu đãi đã được duyệt.
- **Dữ liệu hợp lệ:** ghi nhận tên tệp, thời điểm nhập và ngày đối chiếu để phục vụ truy vết.

Chỉ chuyển sang B2 khi không còn lỗi nghiêm trọng. Cảnh báo thiếu dữ liệu được mang theo hồ sơ qua các bước sau.

## B2. AI hợp nhất và chuẩn hóa dữ liệu

AI chuẩn hóa tên cột, định dạng ngày và trạng thái; ghép các nguồn theo `contract_id`/`customer_id`; giữ liên kết tới tệp, dòng dữ liệu và ngày đối chiếu ban đầu. Kết quả được lưu thành một phiên bản dữ liệu đã xử lý, không ghi đè lên tệp gốc.

## B3. Người kiểm duyệt dữ liệu

Người kiểm duyệt xem hồ sơ đã hợp nhất, cảnh báo, dữ liệu thiếu và các điểm không khớp.

- **Nếu chưa đạt:** người kiểm duyệt ghi phản hồi cụ thể. AI xử lý lại phần bị yêu cầu trên dữ liệu gốc và các quy tắc đã ghi nhận, tạo **phiên bản dữ liệu mới** kèm nhật ký thay đổi. Quay lại B3 để kiểm tra phiên bản mới; không xóa phiên bản cũ.
- **Nếu đạt:** người kiểm duyệt xác nhận phiên bản dữ liệu được phép dùng và chuyển sang B4. Cảnh báo chưa thể khắc phục phải được chấp nhận rõ ràng và tiếp tục hiển thị ở các bước sau.

## B4. AI phân tích và lập đề xuất

AI tính tỷ lệ sử dụng từ Active Users / Licensed Users; xác định ngày liên hệ mục tiêu theo ngày hết hạn và thời gian báo trước; kiểm tra ticket đang mở trước khi đề xuất upsell; đối chiếu điều kiện ưu đãi với chính sách.

Với mỗi hợp đồng, AI tạo đề xuất giữ gói hoặc thay gói, lý do, căn cứ dữ liệu, giá trị tính được, thông tin chưa xác định, điều kiện cần người duyệt và đầu việc tiếp theo. Nếu dữ liệu cần thiết còn thiếu, kết quả phải thể hiện **“Chưa đủ căn cứ”** thay vì đưa ra kết luận chắc chắn.

## B5. Tạo kết quả để duyệt

AI tổng hợp hồ sơ theo tình trạng, kế hoạch liên hệ và phối hợp cho Kinh doanh, CSKH, Hỗ trợ; tạo bản nháp trao đổi với khách; lưu nhật ký nguồn dữ liệu, quy tắc và các bước chạy. Bản nháp không được coi là nội dung đã gửi khách hoặc là cam kết đã được phê duyệt.

## B6. Người duyệt cuối

Người duyệt xem đề xuất, căn cứ, cảnh báo và kế hoạch hành động.

- **Nếu chưa đạt:** ghi phản hồi cụ thể. AI chạy lại phần phân tích/đề xuất có liên quan, tạo **phiên bản kết quả mới** và lưu tham số, quy tắc cùng khác biệt so với phiên bản trước. Quay lại B6 để duyệt; không tự sửa dữ liệu nguồn hoặc xóa kết quả cũ. Nếu phản hồi cho thấy dữ liệu đầu vào sai, chuyển hồ sơ về B2/B3 để hiệu chỉnh và duyệt lại dữ liệu trước khi phân tích lại.
- **Nếu đạt:** ghi nhận người duyệt và phiên bản được duyệt; sau đó xuất kết quả HTML/Excel theo yêu cầu.

## Luồng tóm tắt

```text
Nhập tệp
  ├─ Có lỗi nghiêm trọng ─> Báo lỗi chi tiết ─> Tải lại tệp
  └─ Qua kiểm tra ─> Hợp nhất/chuẩn hóa ─> Người duyệt dữ liệu
                         ▲                       ├─ Chưa đạt ─> AI xử lý lại, tạo phiên bản mới ─┘
                         │                       └─ Đạt ─> Phân tích/đề xuất ─> Người duyệt cuối
                         │                                                        ├─ Chưa đạt ─> AI chạy lại, tạo phiên bản mới ─┐
                         └──────── Nếu phản hồi cuối phát hiện lỗi dữ liệu ───────────────────────────────────────────────────────┘
                                                                                  └─ Đạt ─> Xuất HTML/Excel
```
