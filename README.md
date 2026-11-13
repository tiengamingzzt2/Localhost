# An Tín Renewal Agent

Ứng dụng web chạy tại máy cá nhân để chuẩn bị gia hạn hợp đồng. Ứng dụng dùng Node.js tích hợp sẵn, không cần cài dependency hoặc cấu hình API key.

## Chạy ứng dụng

**Cách nhanh:** bấm đúp **KHOI_DONG_AGENT.cmd** trong thư mục dự án. File sẽ khởi động server, đợi sẵn sàng rồi mở giao diện web. Nếu Agent đã chạy, file mở lại giao diện và dùng server hiện có. Giữ cửa sổ khởi động khi làm việc, nhấn `Ctrl+C` để dừng server do cửa sổ đó khởi động. Máy cần cài Node.js và giữ nguyên thư mục dự án.

Hoặc mở PowerShell tại thư mục dự án và chạy:

```powershell
node server.js
```

Mở <http://localhost:4173>. Dừng máy chủ bằng `Ctrl+C` trong cửa sổ PowerShell.

## Quy trình trong giao diện

Menu bên trái chứa bốn bước quy trình, bộ lọc nhóm đề xuất, hồ sơ đã duyệt, nhật ký và nút thao tác chính của bước hiện tại. Thống kê được thu gọn và có thể ẩn/hiện. Phản hồi và tham số mở bằng nút **Phản hồi / tham số**, dùng lại các trường hiện có trong một cửa sổ riêng; đóng cửa sổ sẽ giữ bản nháp. Hướng dẫn sử dụng nằm trong menu, không chiếm phần đầu trang làm việc. Trên màn hình nhỏ, dùng nút menu ở góc trên trái.

Mục **Dashboard / Biểu đồ** trong Công cụ cho phép tạo biểu đồ tròn, đường và cột từ từng tệp đã làm sạch hoặc kết quả phân tích (toàn bộ/chờ duyệt/đã duyệt). Chọn trường nhóm, đếm bản ghi/tổng/trung bình và gộp ngày theo tháng hoặc ngày; có mẫu tạo nhanh và dashboard gợi ý. Có thể giữ tối đa 6 biểu đồ, xem bảng số liệu tổng hợp, bỏ từng biểu đồ hoặc tải SVG. Giá trị thiếu không tự đổi thành 0. Dashboard cập nhật theo dữ liệu trong phiên; làm sạch bộ dữ liệu mới sẽ đặt lại các biểu đồ.

Nút **Dark mode** nằm cuối nhóm Công cụ, chuyển giữa nền sáng và nền xám than với điểm nhấn xanh tím nhẹ. Hiệu ứng vòng tròn lan từ công tắc ra toàn trang trong 1,1 giây, chuyển cả nền, chữ, bảng và biểu đồ cùng nhau. Trình duyệt chưa hỗ trợ dùng hiệu ứng hòa màu 0,9 giây. Chữ dùng các sắc trắng/xám sáng; màu trạng thái tập trung ở nhãn và dữ liệu. Lựa chọn được lưu trên trình duyệt và áp dụng trước khi hiển thị trang; lần đầu dùng theo chế độ của hệ thống. Chuyển chế độ không tải lại trang hoặc làm mất dữ liệu, lựa chọn và phản hồi đang nhập. Hiệu ứng được tắt khi hệ thống bật giảm chuyển động.

1. Chọn hoặc kéo thả một/nhiều tệp CSV/XLSX vào **một vùng tải lên duy nhất**, tổng tối đa 20 MB. Agent tự bắt đầu đọc, nhận diện loại dữ liệu theo nội dung cột và làm sạch; người dùng không phải chia nhóm tệp. Tệp mới cùng tên thay thế bản cũ trong phiên.
2. Xem dữ liệu đã chuẩn hóa (50 dòng/trang), chọn tệp kết quả và tải CSV đã làm sạch. Dữ liệu dạng bảng chưa nhận diện là hợp đồng vẫn được làm sạch và tải xuống. Với dữ liệu hợp đồng, hệ thống ghép các nguồn theo khách hàng để người dùng kiểm duyệt.
3. Chạy phân tích; ngày liên hệ mặc định trước hạn 45 ngày, ngưỡng adoption mặc định 70%.
4. Duyệt cuối, chạy lại nếu cần, rồi xuất HTML hoặc CSV.

Có thể bấm trực tiếp các nút trên thanh quy trình để mở lại bước đã có kết quả. Tệp, lựa chọn, trạng thái duyệt và phản hồi đang nhập được giữ khi chuyển bước. Bước chưa đủ điều kiện sẽ bị khóa kèm lý do; bước duyệt cuối mở khi đã có lượt duyệt trước hoặc đã chọn hồ sơ để chuyển duyệt. Việc chuyển bước chỉ mở kết quả đã lưu trong phiên, không tự chạy lại Agent.

Ở bước phân tích và duyệt cuối, có thể tìm hồ sơ theo mã khách hàng, mã hợp đồng hoặc tên khách; lọc theo bốn nhóm đề xuất được phân biệt bằng nhãn và màu. Tích từng hồ sơ, tích cả trang, hoặc chọn tất cả kết quả lọc. Lựa chọn được giữ khi tìm kiếm và chuyển trang. Chỉ hồ sơ đã chọn được chuyển sang duyệt cuối và xuất ra CSV/HTML; bộ lọc không tự xóa lựa chọn ngoài màn hình. Khi chạy lại phân tích, cần chọn lại hồ sơ trên phiên bản kết quả mới.

Sau khi bấm **Duyệt** hoặc **Duyệt & xuất** ở bước cuối, các hồ sơ đã chọn tự ẩn khỏi mục **Chờ duyệt** ở cả bước phân tích và duyệt cuối. Chuyển sang **Đã duyệt** để xem và tải lại kết quả CSV/HTML. Trạng thái này gắn với phiên kết quả đang mở; chạy lại phân tích tạo phiên bản mới cần duyệt lại.

Nút **Xem email** trên mỗi hợp đồng mở cửa sổ xem trước, cho sửa tiêu đề/nội dung và sao chép sau khi kiểm tra. **Agent viết lại** hỗ trợ giọng trang trọng/thân thiện, ba độ dài, ẩn/hiện giá trị và các yêu cầu như “ngắn gọn hơn, không nhắc giá” hoặc “Thêm câu: …”. Việc viết lại dùng mẫu cục bộ và dữ liệu hợp đồng; yêu cầu chưa hỗ trợ được báo rõ, không tự thay nội dung. Có nút hoàn tác. Bản nháp được giữ riêng theo mã khách + mã hợp đồng trong phiên phân tích; mở lại vẫn giữ bản sửa, phân tích mới sẽ đặt lại. Thao tác email không chọn hoặc phê duyệt hồ sơ.

Các thẻ thống kê cập nhật theo bước và danh sách đang xem, gồm cả tìm kiếm/bộ lọc: số hồ sơ, số cần xác minh, số chặn upsell và giá trị đủ căn cứ tính. Chuyển 7/50 hồ sơ sang duyệt cuối sẽ hiển thị 7 ở bước cuối; duyệt xong rồi quay lại sẽ còn 43 hồ sơ chờ. Thanh tiến độ tính số hồ sơ đã duyệt trên tổng số hồ sơ phân tích của phiên; đổi bộ lọc không thay đổi tiến độ này. Các nhãn số lượng trên thanh quy trình thể hiện tệp đầu vào, hồ sơ chuẩn hóa, hồ sơ đang chờ và số đã duyệt.

Chỉ bước phân tích gia hạn mới cần dữ liệu hợp đồng phù hợp. Hợp đồng thiếu mã khách hàng, ngày hết hạn hoặc bị trùng khóa vẫn cần sửa trước khi chuyển bước. Thiếu nhật ký sử dụng, ticket hoặc chính sách được báo là **Chưa có dữ liệu**. Các trường thiếu không được coi là 0. Có ticket mở sẽ chặn đề xuất upsell. Giá trị gia hạn chỉ tính khi có giá khớp theo mã khách hoặc gói.

## Cột dữ liệu

Tại bước **Nạp dữ liệu**, chọn **Tải file mẫu XLSX** hoặc **Quy tắc & các trường hợp**. File mẫu có trang `Du_lieu` ở đầu để điền và tải lên; trang `Huong_dan` giải thích từng trường. Thay các dòng ví dụ bằng dữ liệu thật, giữ hàng 1 là tên cột và một dòng cho một hợp đồng.

Quy tắc kiểm tra đầu vào:

- `customer_id` và `expiration_date` luôn bắt buộc trên mỗi hợp đồng. Ngày phải hợp lệ, dùng `YYYY-MM-DD` hoặc `DD/MM/YYYY`.
- `contract_id` có thể trống nếu một khách chỉ có một hợp đồng. Khách có nhiều hợp đồng phải điền mã trên từng dòng. Cặp mã khách + mã hợp đồng không được trùng.
- Thiếu tên khách, gói, ngày đối chiếu hoặc chiết khấu không chặn làm sạch. Khi thiếu chiết khấu, giá hiển thị là giá gốc tham khảo, chưa áp dụng ưu đãi.
- Thiếu lẻ tẻ số tài khoản được cấp, người dùng hoạt động, ticket hoặc giá vẫn được duyệt với giới hạn rõ ràng; không tự coi ô trống là 0. Nếu một trường cần thiết thiếu/sai toàn bộ, hoặc hơn 5 hồ sơ bị ảnh hưởng và chiếm trên 10% số hợp đồng, quy trình bị chặn và yêu cầu bổ sung file gốc rồi tải lại. Kiểm tra sau khi ghép nguồn phụ; `status` hợp lệ có thể thay số ticket, bảng chính sách khớp khóa có thể cung cấp giá.
- Số tài khoản được cấp phải là số nguyên lớn hơn 0; người dùng hoạt động và ticket là số nguyên không âm. Giá tính bằng VND, không âm. `discount` dùng số phần trăm từ 0 đến 100: `10` hoặc `10%` là 10%, `1` là 1%. Không dùng định dạng phần trăm của Excel cho cột này; nhập trực tiếp số như trong mẫu.
- Trường bổ sung sai định dạng được cảnh báo và đưa về trống trong bản làm sạch; tệp gốc giữ nguyên. Chiết khấu sai sẽ làm giá trị gia hạn chưa xác định, không tự dùng chiết khấu 0. Ticket sai hoặc mâu thuẫn không được biến thành xác nhận không có sự cố.
- Nguồn phụ thiếu khóa ghép hoặc có các dòng cùng khóa nhưng khác nội dung sẽ được cảnh báo, không âm thầm lấy dòng cuối. Dữ liệu bảng khác vẫn được làm sạch và tải xuống nhưng không mở phân tích gia hạn khi chưa có hợp đồng.

Kết quả làm sạch hiển thị số hợp đồng qua kiểm tra khóa, số đủ dữ liệu nghiệp vụ, số còn giới hạn và các trường thiếu kèm ảnh hưởng. Danh sách cảnh báo chỉ hiển thị mẫu ngắn; tổng số cảnh báo vẫn được đếm đầy đủ.

Khi chỉ sai vài ô, thông báo có hai lựa chọn **Tự sửa dữ liệu** và **Để Agent sửa định dạng**. Khi thiếu/sai toàn bộ trường bắt buộc, trùng khóa trên diện rộng hoặc thiếu nhiều dữ liệu phân tích, thông báo chỉ rõ trường và số hồ sơ ảnh hưởng, ẩn các nút sửa và yêu cầu **Chọn lại bộ tệp đã bổ sung**. Chọn đầy đủ các nguồn cần dùng; bộ tệp mới thay bộ cũ sau khi đọc thành công. Hủy chọn tệp giữ nguyên dữ liệu hiện tại. API sửa cũng từ chối dữ liệu cần tải lại, không chỉ ẩn nút trên giao diện.

- Tự sửa: ghép các cột nguồn với tên trường chuẩn, thêm cột trống nếu cần, sửa ô trực tiếp trong bảng 20 dòng/trang, hoặc tải bản CSV đang sửa xuống.
- Agent sửa: tạo bản xem trước với tên cột và ngày được chuẩn hóa theo quy tắc. Ngày `DD/MM/YYYY` được chuyển thành `YYYY-MM-DD`; CSV dùng dấu phẩy, chấm phẩy và tab đều được nhận diện.
- Mã hoặc ngày còn thiếu cần người dùng bổ sung. Bản ghi hợp đồng trùng hoàn toàn chỉ được loại khi chọn ô tương ứng; các bản ghi cùng khóa nhưng khác nội dung vẫn cần kiểm tra.
- Nhấn **Áp dụng bản sửa & kiểm tra lại** để chạy lại bước kiểm tra. Tệp gốc trên máy không bị ghi đè; lỗi bắt buộc còn tồn tại sẽ tiếp tục chặn quy trình.

Kiểm tra chức năng sửa dữ liệu: `node --test tests/repair.cjs`.

Tên cột có thể bằng tiếng Việt hoặc tiếng Anh. Các cột tối thiểu trong hợp đồng:

- `customer_id` / `Mã khách hàng`
- `expiration_date` / `Ngày hết hạn`

Cột được nhận diện thêm khi có: `contract_id`, `customer_name`, `plan`, `licensed_users`, `active_users`, `snapshot_date`, `open_tickets`, `status`, `price`, `discount`. Tệp gói/chính sách có thể ghép theo mã khách hàng hoặc tên gói. Nếu cấu trúc file của lớp khác các tên này, cần bổ sung ánh xạ cột sau khi nhận schema chính thức.

## Giới hạn bản chạy hiện tại

Agent dùng các kỹ năng xử lý dữ liệu và quy tắc nghiệp vụ xác định, chạy cục bộ; đây chưa phải mô hình ngôn ngữ lớn. Nhật ký kiểm tra được lưu trong localStorage của trình duyệt. Bản hiện tại đọc trang tính đầu tiên của XLSX và chưa xử lý công thức Excel.
