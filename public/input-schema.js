const inputSchema={version:2,validation:{minorMaxRows:5,minorMaxRatio:0.1},fields:[
  {key:'customer_id',label:'Mã khách hàng',level:'required',format:'Văn bản, giữ nguyên số 0 ở đầu',example:'KH001',missing:'Bắt buộc có trên mọi dòng hợp đồng để xác định khách và ghép nguồn.'},
  {key:'contract_id',label:'Mã hợp đồng',level:'conditional',format:'Văn bản; cặp mã khách + mã hợp đồng không trùng',example:'HD-2026-001',missing:'Có thể trống nếu khách chỉ có một hợp đồng. Khách có nhiều hợp đồng phải điền mã cho từng hợp đồng.'},
  {key:'expiration_date',label:'Ngày hết hạn',level:'required',format:'YYYY-MM-DD hoặc DD/MM/YYYY; ngày phải tồn tại',example:'2026-12-20',missing:'Thiếu hoặc sai ngày sẽ chặn bước tiếp theo; Agent không tự đoán ngày.'},
  {key:'customer_name',label:'Tên khách hàng',level:'optional',format:'Văn bản',example:'Công ty mẫu Minh An',missing:'Vẫn tiếp tục; hiển thị mã khách thay cho tên.'},
  {key:'plan',label:'Gói hiện tại',level:'optional',format:'Văn bản',example:'Pro',missing:'Vẫn tiếp tục; chưa có tên gói, không ghép được chính sách theo gói.'},
  {key:'licensed_users',label:'Số tài khoản được cấp',level:'analysis',format:'Số nguyên lớn hơn 0',example:'50',missing:'Thiếu vài ô: chưa tính tỷ lệ sử dụng cho các dòng đó. Thiếu cả trường hoặc trên diện rộng: bổ sung file gốc và tải lại.'},
  {key:'active_users',label:'Người dùng hoạt động',level:'analysis',format:'Số nguyên từ 0 trở lên; 0 là dữ liệu thực',example:'44',missing:'Thiếu vài ô: giữ chưa có dữ liệu. Thiếu cả trường hoặc trên diện rộng: bổ sung file gốc và tải lại, không tự đoán mức sử dụng.'},
  {key:'open_tickets',label:'Ticket đang mở',level:'analysis',format:'Số nguyên từ 0 trở lên; chỉ điền 0 khi đã xác minh',example:'0',missing:'Có thể dùng status hợp lệ thay thế. Thiếu cả hai trên toàn bộ hoặc nhiều hồ sơ: bổ sung nguồn hỗ trợ rồi tải lại. Ô trống không phải 0 ticket.'},
  {key:'price',label:'Giá gia hạn trước chiết khấu (VND)',level:'analysis',format:'Số từ 0 trở lên; nên nhập không có dấu phân cách',example:'12000000',missing:'Có thể lấy giá từ bảng chính sách khớp khóa. Nếu vẫn thiếu cả trường hoặc trên diện rộng: bổ sung file gốc và tải lại.'},
  {key:'discount',label:'Chiết khấu (%)',level:'optional',format:'Số từ 0 đến 100; 10 hoặc 10% là 10%, 1 là 1%',example:'10',missing:'Để trống: dùng giá gốc tham khảo, chưa áp dụng ưu đãi. Giá trị sai sẽ cần xác minh trước khi tính tiền.'},
  {key:'snapshot_date',label:'Ngày đối chiếu',level:'optional',format:'YYYY-MM-DD hoặc DD/MM/YYYY',example:'2026-11-12',missing:'Vẫn tiếp tục; chưa xác định thời điểm đối chiếu của nguồn dữ liệu.'},
  {key:'status',label:'Trạng thái hỗ trợ',level:'optional',format:'Open/Pending/In progress hoặc Closed/Resolved',example:'Resolved',missing:'Vẫn tiếp tục khi đã có open_tickets. Không suy ra 0 ticket từ ô trống.'}
],steps:[
  'Đọc CSV/XLSX và nhận diện cột tiếng Việt hoặc tiếng Anh.',
  'Kiểm tra mã khách, ngày hết hạn và tính duy nhất của khóa hợp đồng.',
  'Bỏ khoảng trắng thừa; chuẩn hóa tên cột, ngày và số hợp lệ. Không tự bịa dữ liệu còn thiếu.',
  'Giữ tệp gốc; trả bản làm sạch, cảnh báo và phạm vi có thể phân tích để người dùng duyệt.'
]};
if(typeof module!=='undefined' && module.exports)module.exports=inputSchema;
