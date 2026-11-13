/**
 * ==============================================================================
 * AN TÍN RENEWAL AGENT - BỘ ĐIỀU HÀNH MÀN HÌNH CHỜ & GIỚI THIỆU GIẢI PHÁP (INTRO)
 * Tương tác toàn diện: 4 Kỹ năng AI, Chốt chặn HITL, Xem trước Hồ sơ, Chuyển cảnh siêu mượt
 * ==============================================================================
 */

(function () {
  const introScreen = document.querySelector('#introScreen');
  const workspaceShell = document.querySelector('#workspaceShell');
  const cardsCanvas = document.querySelector('.cards-canvas');

  if (!introScreen || !workspaceShell) return;

  let isTransitioning = false;

  // 1. Chuyển cảnh siêu mượt vào Không gian làm việc (Hardware Accelerated 60/120 FPS)
  function enterWorkspace(autoLoadDemo = false) {
    if (isTransitioning) return;
    isTransitioning = true;

    // Đóng tất cả dialog đang mở nếu có
    document.querySelectorAll('dialog.intro-dialog[open]').forEach(d => d.close());

    // Kích hoạt transition GPU: Intro trượt lên mờ dần, Workspace trượt vào sắc nét
    introScreen.classList.remove('is-entering');
    introScreen.classList.add('is-exiting');

    workspaceShell.classList.remove('is-hidden');
    workspaceShell.classList.add('is-active');

    if (window.location.hash !== '#workflow') {
      history.replaceState(null, '', '#workflow');
    }

    setTimeout(() => {
      introScreen.classList.add('is-hidden');
      introScreen.classList.remove('is-exiting');
      isTransitioning = false;

      if (autoLoadDemo) {
        const demoBtn = document.querySelector('#demoBtn');
        if (demoBtn) demoBtn.click();
      }
    }, 480);
  }

  // 2. Quay lại Màn hình Giới thiệu Giải pháp (Chuyển động ngược siêu mượt)
  function showIntro() {
    if (isTransitioning) return;
    isTransitioning = true;

    workspaceShell.classList.add('is-hidden');
    workspaceShell.classList.remove('is-active');

    introScreen.classList.remove('is-hidden', 'is-exiting');
    introScreen.classList.add('is-entering');

    history.replaceState(null, '', '#intro');

    setTimeout(() => {
      introScreen.classList.remove('is-entering');
      isTransitioning = false;
    }, 460);
  }

  // 3. Gán sự kiện click các nút thao tác chính
  const enterBtn = document.querySelector('#enterWorkspaceBtn');
  const heroStartBtn = document.querySelector('#heroStartBtn');
  const heroDemoBtn = document.querySelector('#heroDemoBtn');
  const introThemeToggle = document.querySelector('#introThemeToggle');

  if (enterBtn) enterBtn.addEventListener('click', () => enterWorkspace(false));
  if (heroStartBtn) heroStartBtn.addEventListener('click', () => enterWorkspace(false));
  if (heroDemoBtn) heroDemoBtn.addEventListener('click', () => enterWorkspace(true));

  // Logo brand & Nút trên topbar quay về intro
  const sidebarBrand = document.querySelector('.sidebar-brand-row .brand');
  const topNavIntroBtn = document.querySelector('#topNavIntroBtn');
  if (sidebarBrand) {
    sidebarBrand.addEventListener('click', (e) => {
      e.preventDefault();
      showIntro();
    });
  }
  if (topNavIntroBtn) {
    topNavIntroBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showIntro();
    });
  }

  // Đồng bộ nút Dark mode trên màn hình Intro với toàn hệ thống
  if (introThemeToggle) {
    introThemeToggle.addEventListener('click', () => {
      const themeBtn = document.querySelector('#themeToggle');
      if (themeBtn) {
        themeBtn.click();
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        introThemeToggle.innerHTML = isDark ? '☀ Light mode' : '☾ Dark mode';
      }
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    introThemeToggle.innerHTML = isDark ? '☀ Light mode' : '☾ Dark mode';
  }

  // 4. Quản lý Modal & Hộp thoại chi tiết (Interactive Dialogs)
  const skillsDialog = document.querySelector('#skillsDialog');
  const hitlDialog = document.querySelector('#hitlDialog');
  const previewDialog = document.querySelector('#previewDialog');
  const previewDialogTitle = document.querySelector('#previewDialogTitle');
  const previewDialogContent = document.querySelector('#previewDialogContent');
  const aboutDialog = document.querySelector('#aboutDialog');

  // Đóng dialog khi bấm nút close hoặc click ra ngoài phông nền (backdrop)
  document.querySelectorAll('dialog.intro-dialog').forEach(dialog => {
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) dialog.close();
    });
  });

  document.querySelectorAll('[data-dialog-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const parentDialog = btn.closest('dialog');
      if (parentDialog) parentDialog.close();
    });
  });

  // Nút hành động bên trong các Modal chuyển thẳng vào Workspace
  const btnSkillsToWorkspace = document.querySelector('#btnSkillsToWorkspace');
  if (btnSkillsToWorkspace) {
    btnSkillsToWorkspace.addEventListener('click', () => {
      skillsDialog?.close();
      enterWorkspace(false);
    });
  }

  const btnHitlToWorkspace = document.querySelector('#btnHitlToWorkspace');
  if (btnHitlToWorkspace) {
    btnHitlToWorkspace.addEventListener('click', () => {
      hitlDialog?.close();
      enterWorkspace(false);
    });
  }

  const btnPreviewToWorkspace = document.querySelector('#btnPreviewToWorkspace');
  if (btnPreviewToWorkspace) {
    btnPreviewToWorkspace.addEventListener('click', () => {
      previewDialog?.close();
      enterWorkspace(true);
    });
  }

  // Mở Modal 4 Kỹ Năng AI
  const introNavSkills = document.querySelector('#introNavSkills');
  if (introNavSkills) {
    introNavSkills.addEventListener('click', () => {
      if (skillsDialog) skillsDialog.showModal();
    });
  }

  // Mở Modal Chốt chặn HITL
  const introNavRules = document.querySelector('#introNavRules');
  if (introNavRules) {
    introNavRules.addEventListener('click', () => {
      if (hitlDialog) hitlDialog.showModal();
    });
  }

  // Mở Modal Hướng dẫn sử dụng
  const introNavGuide = document.querySelector('#introNavGuide');
  const introBadge = document.querySelector('.intro-badge');
  if (introNavGuide) {
    introNavGuide.addEventListener('click', () => {
      if (aboutDialog) aboutDialog.showModal();
    });
  }
  if (introBadge) {
    introBadge.style.cursor = 'pointer';
    introBadge.title = 'Bấm để xem hướng dẫn sử dụng giải pháp';
    introBadge.addEventListener('click', () => {
      if (aboutDialog) aboutDialog.showModal();
    });
  }

  // 5. Nội dung động hiển thị chi tiết (Modal Preview Engine)
  const previewTemplates = {
    kh001: {
      title: '✦ Hồ sơ Thẩm định & Bản nháp Email (KH001 - Công ty CP Công nghệ Tiên Phong)',
      content: `
        <div class="skill-card-item" style="border-left: 4px solid #526640; margin-bottom: 14px;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <span class="tag-status tag-upsell">🔥 UPSELL PRO (35M) - KHUYẾN NGHỊ TĂNG GÓI</span>
              <span style="font-weight:700; color:#3b5629; font-size:13px;">Doanh thu kỳ vọng: 35,000,000 VNĐ</span>
            </div>
            <strong>1. Phân tích Dữ liệu Đối soát Đa Nguồn:</strong>
            <p>• <b>Hợp đồng hiện tại:</b> Gói Basic (15,000,000 VNĐ), hết hạn 20/12/2026 (còn 24 ngày đến hạn).<br>
               • <b>Tỷ lệ khai thác (Adoption):</b> 95% (23 người dùng thực tế / 20 seats ban đầu ➔ Đang vượt công suất thiết kế 115%).<br>
               • <b>Lịch sử sự cố kỹ thuật:</b> 0 ticket mở (Hệ thống vận hành trơn tru, dịch vụ ổn định 100%).<br>
               • <b>Căn cứ phê duyệt AI:</b> Khách hàng có nhu cầu mở rộng thực tế cao, thỏa mãn điều kiện thăng hạng lên gói Pro (50 tài khoản) kèm chính sách chiết khấu 15% năm đầu.</p>
          </div>
        </div>

        <div class="preview-table-box">
          <table>
            <thead>
              <tr>
                <th>Thông số đối chiếu</th>
                <th>Gói hiện tại (Basic)</th>
                <th>Đề xuất mới (Pro)</th>
                <th>Giá trị gia tăng</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Số tài khoản (Seats)</td>
                <td>20 người dùng</td>
                <td><b>50 người dùng</b></td>
                <td>Hết tình trạng nghẽn đăng nhập</td>
              </tr>
              <tr>
                <td>Đơn giá niêm yết</td>
                <td>15,000,000 VNĐ</td>
                <td>35,000,000 VNĐ</td>
                <td>Tối ưu 30% so với mua thêm lẻ</td>
              </tr>
              <tr>
                <td>Ưu đãi tái ký sớm</td>
                <td>Không áp dụng</td>
                <td><b>Chiết khấu 15%</b></td>
                <td>Chỉ còn 29,750,000 VNĐ năm đầu</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <strong style="font-size: 13px; color: #314424;">2. Bản nháp Email B2B do AI tự động soạn thảo:</strong>
            <button type="button" class="btn-copy-email" id="btnCopyIntroEmail" title="Sao chép toàn bộ nội dung email">📋 Sao chép Email</button>
          </div>
          <div class="preview-email-box" id="introEmailText">Kính gửi: Ban Giám đốc & Bộ phận CNTT - Công ty CP Công nghệ Tiên Phong,

Lời đầu tiên, An Tín xin chân thành cảm ơn Quý công ty đã tin tưởng đồng hành cùng giải pháp của chúng tôi trong suốt năm qua.

Theo dõi hệ thống đối soát định kỳ, chúng tôi ghi nhận tháng vừa qua Quý công ty đã có 23 thành viên hoạt động thường xuyên trên gói 20 seats (đạt 115% công suất thiết kế), đồng thời hệ thống duy trì hoạt động ổn định tuyệt đối (0 ticket lỗi kỹ thuật).

Nhằm hỗ trợ Quý công ty mở rộng quy mô kinh doanh không bị gián đoạn và tối ưu chi phí, An Tín trân trọng đề xuất gói nâng cấp Pro (50 seats) với chính sách đặc quyền tái ký sớm trước 30 ngày:
• Ưu đãi chiết khấu trực tiếp 15% phí dịch vụ năm đầu.
• Tặng gói đào tạo chuyển giao tính năng quản trị nâng cao.
• Giữ nguyên thời hạn và tự động cộng dồn ngày sử dụng còn lại.

Rất mong được tiếp tục phục vụ Quý khách hàng. Đại diện CSKH An Tín sẽ liên hệ trong ngày mai để hoàn tất thủ tục phụ lục.

Trân trọng,
An Tín Renewal Operations Team</div>
        </div>
      `
    },

    kh036: {
      title: '🛑 Chốt chặn HITL & Quyết định Khóa Chào Bán (KH036 - Công ty Thiết bị Y khoa Cửu Long)',
      content: `
        <div class="skill-card-item" style="border-left: 4px solid #b83c28; background: #fff8f7; margin-bottom: 14px;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <span class="guardrail-badge" style="margin-bottom:0;">🛑 CHỐT CHẶN BẢO VỆ ĐANG KÍCH HOẠT</span>
              <span style="font-weight:700; color:#b83c28; font-size:12px;">TRẠNG THÁI: KHÓA BÁO GIÁ GÓI MỚI</span>
            </div>
            <strong style="color:#8a2817;">1. Phát hiện sự cố kỹ thuật chưa giải quyết:</strong>
            <p style="color:#7d3e34;">• <b>Mã sự cố kỹ thuật:</b> <code>INC-2026-1036</code> (Lỗi xuất hóa đơn điện tử tích hợp trên hệ thống kế toán).<br>
               • <b>Thời gian mở ticket:</b> 3 ngày trước · Mức độ ưu tiên: Khẩn cấp (P1).<br>
               • <b>Tỷ lệ khai thác:</b> 68% · Thời hạn gia hạn: Còn 18 ngày.<br>
               • <b>Quy tắc chốt chặn (Hard Guardrail Rule):</b> Tuyệt đối không gửi email chào bán tăng gói hoặc hối thúc gia hạn khi khách hàng đang có sự cố chưa nghiệm thu. Vi phạm điều này sẽ gây bức xúc và dẫn đến mất khách hàng vĩnh viễn (Churn risk).</p>
          </div>
        </div>

        <div class="skill-card-item" style="border-left: 4px solid #a66c25; margin-bottom: 14px;">
          <div>
            <strong style="color:#945f1e;">2. Kế hoạch tác chiến phối hợp 3 bên (Support - CSKH - Sales):</strong>
            <div class="preview-table-box" style="margin-top:8px;">
              <table>
                <thead>
                  <tr>
                    <th>Bộ phận</th>
                    <th>Hành động cụ thể</th>
                    <th>Thời hạn SLA</th>
                    <th>Trách nhiệm nghiệm thu</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>Kỹ thuật Support</b></td>
                    <td>Sửa triệt để module đồng bộ hóa đơn, test luồng và gửi biên bản kiểm thử xác nhận.</td>
                    <td>Trước 17:00 hôm nay</td>
                    <td>Trưởng nhóm Tech</td>
                  </tr>
                  <tr>
                    <td><b>CSKH (Account Mgr)</b></td>
                    <td>Gọi điện thoại xin lỗi đại diện khách hàng, cập nhật lộ trình sửa lỗi và cam kết chất lượng.</td>
                    <td>Trong sáng mai</td>
                    <td>CS Lead</td>
                  </tr>
                  <tr>
                    <td><b>Kinh doanh (Sales)</b></td>
                    <td>Chỉ mở lại quy trình báo giá gia hạn sau khi ticket chuyển sang "Closed - Đã nghiệm thu".</td>
                    <td>Sau khi đóng ticket</td>
                    <td>Sales Director</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `
    },

    revenue: {
      title: '💰 Báo cáo Dự báo Doanh thu An toàn (Bộ Dữ liệu 100 Khách hàng)',
      content: `
        <div class="skill-card-item" style="border-left: 4px solid #526640; margin-bottom: 14px;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <span class="tag-status tag-upsell" style="background:#e4ede0; color:#3b5629;">💰 DOANH THU AN TOÀN ĐÃ XÁC THỰC</span>
              <span style="font-weight:800; color:#314b21; font-size:16px;">2,517,500,000 VNĐ</span>
            </div>
            <p>Tổng giá trị hợp đồng danh nghĩa trên danh sách 100 khách hàng là <b>3,420,000,000 VNĐ</b>. Tuy nhiên, AI Agent đã thực hiện đối soát và thẩm định đa tầng, loại trừ các khoản doanh thu rủi ro để bảo toàn tính chuẩn xác tài chính:</p>
          </div>
        </div>

        <div class="preview-table-box">
          <table>
            <thead>
              <tr>
                <th>Phân nhóm thẩm định</th>
                <th>Số lượng HĐ</th>
                <th>Giá trị (VNĐ)</th>
                <th>Tỷ trọng</th>
                <th>Trạng thái xử lý của Agent</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>✓ Doanh thu an toàn (Đạt chuẩn)</b></td>
                <td><b>75 HĐ</b></td>
                <td><b>2,517,500,000</b></td>
                <td><b>73.6%</b></td>
                <td><span style="color:#46692e; font-weight:700;">Sẵn sàng ký duyệt & gửi báo giá</span></td>
              </tr>
              <tr>
                <td><b>🛑 Tạm khóa do có Ticket lỗi</b></td>
                <td>15 HĐ</td>
                <td>540,000,000</td>
                <td>15.8%</td>
                <td><span style="color:#b83c28; font-weight:700;">Khóa chờ Kỹ thuật nghiệm thu</span></td>
              </tr>
              <tr>
                <td><b>❓ Chờ xác minh IT (Thiếu Log)</b></td>
                <td>10 HĐ</td>
                <td>362,500,000</td>
                <td>10.6%</td>
                <td><span style="color:#a66c25; font-weight:700;">Chuyển IT kiểm tra hệ thống log</span></td>
              </tr>
              <tr style="background:#f4f6ee; font-weight:700;">
                <td>Tổng cộng danh mục</td>
                <td>100 HĐ</td>
                <td>3,420,000,000</td>
                <td>100%</td>
                <td>Đối soát tự động qua 4 bước</td>
              </tr>
            </tbody>
          </table>
        </div>
      `
    },

    staging: {
      title: '🎯 Tầng Chuẩn hóa Canonical Staging Layer (Lọc sạch Đa Nguồn)',
      content: `
        <div class="skill-card-item" style="border-left: 4px solid #4a673b; margin-bottom: 14px;">
          <div>
            <strong>Kiến trúc Tầng Staging Chuẩn hóa Dữ liệu (Canonical Staging Layer)</strong>
            <p>Trong thực tế doanh nghiệp, dữ liệu đến từ nhiều phòng ban khác nhau (CRM, ERP kế toán, Kỹ thuật Jira/Zendesk, Phần mềm nội bộ) với định dạng cột, tên trường và kiểu dữ liệu không đồng nhất. Agent tích hợp tầng Staging trung gian để xử lý triệt để:</p>
          </div>
        </div>

        <div class="skill-list-grid">
          <div class="skill-card-item">
            <div class="skill-icon-badge">1</div>
            <div>
              <strong>Bước 1: Ingestion & Auto-Mapping (Nhận diện & Khớp trường)</strong>
              <p>Tự động nhận diện các biến thể tên cột: <code>Mã KH</code>, <code>customer_id</code>, <code>CustomerID</code>, <code>CUST_CODE</code> về một chuẩn duy nhất <code>customer_id</code>.</p>
            </div>
          </div>
          <div class="skill-card-item">
            <div class="skill-icon-badge">2</div>
            <div>
              <strong>Bước 2: Data Cleansing & Type Casting (Làm sạch & Ép kiểu)</strong>
              <p>Chuẩn hóa ngày tháng ISO 8601 (YYYY-MM-DD), loại bỏ ký tự tiền tệ phân cách ("15,000,000 đ" ➔ 15000000), loại bỏ khoảng trắng thừa và chuyển đổi kiểu số an toàn.</p>
            </div>
          </div>
          <div class="skill-card-item">
            <div class="skill-icon-badge">3</div>
            <div>
              <strong>Bước 3: Integrity Validation (Kiểm tra toàn vẹn & Phân luồng)</strong>
              <p>Phát hiện bản ghi mồ côi (Orphan records), phát hiện giá trị NULL thiếu sót và cảnh báo trực tiếp người dùng duyệt trước khi đưa vào mô hình phân tích.</p>
            </div>
          </div>
        </div>
      `
    },

    throughput: {
      title: '⚡ Tốc độ Tự động hóa & Khả năng Xử lý Hơn 120 HĐ/tháng',
      content: `
        <div class="skill-card-item" style="border-left: 4px solid #526640; margin-bottom: 14px;">
          <div>
            <strong>So sánh hiệu quả trước và sau khi áp dụng AI Renewal Agent</strong>
            <p>Trước đây, nhân viên CSKH và Sales Operations phải mở từng file Excel, tra cứu Jira xem khách có bị lỗi không, sau đó tính ngày thủ công và soạn từng email gửi. Toàn bộ quy trình mất trung bình 35-45 phút cho mỗi hợp đồng.</p>
          </div>
        </div>

        <div class="preview-table-box">
          <table>
            <thead>
              <tr>
                <th>Tiêu chí so sánh</th>
                <th>Quy trình thủ công cũ</th>
                <th>Với An Tín Renewal Agent</th>
                <th>Mức độ cải thiện</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Thời gian xử lý 1 hợp đồng</td>
                <td>35 - 45 phút / HĐ</td>
                <td><b>&lt; 3 giây / HĐ</b></td>
                <td><span style="color:#46692e; font-weight:700;">Nhanh hơn 700 lần</span></td>
              </tr>
              <tr>
                <td>Khối lượng xử lý hàng tháng</td>
                <td>30 - 40 HĐ / nhân sự</td>
                <td><b>120+ HĐ tự động</b></td>
                <td>Tăng gấp 4 lần năng suất</td>
              </tr>
              <tr>
                <td>Tỷ lệ sai sót / Quên ngày liên hệ</td>
                <td>15 - 20% (bị trễ hạn)</td>
                <td><b>0% sai lệch mốc</b></td>
                <td>Chính xác tuyệt đối</td>
              </tr>
              <tr>
                <td>Rủi ro chào nhầm khách có sự cố</td>
                <td>Thường xuyên xảy ra</td>
                <td><b>Khóa 100% bằng Guardrail</b></td>
                <td>Loại bỏ hoàn toàn rủi ro</td>
              </tr>
            </tbody>
          </table>
        </div>
      `
    }
  };

  function openPreview(key) {
    const data = previewTemplates[key];
    if (!data || !previewDialog || !previewDialogTitle || !previewDialogContent) return;
    previewDialogTitle.textContent = data.title;
    previewDialogContent.innerHTML = data.content;

    // Gán sự kiện cho nút sao chép email nếu có
    const copyBtn = previewDialogContent.querySelector('#btnCopyIntroEmail');
    const emailBox = previewDialogContent.querySelector('#introEmailText');
    if (copyBtn && emailBox) {
      copyBtn.addEventListener('click', async () => {
        const text = emailBox.innerText || emailBox.textContent;
        const success = await window.copyToClipboard(text, '✓ Đã sao chép toàn văn email KH001 vào bộ nhớ tạm!');
        if (success) {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = '✓ Đã chép!';
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = '📋 Sao chép Email';
          }, 2000);
        }
      });
    }

    previewDialog.showModal();
  }

  // Gán sự kiện click cho các Thẻ 3D Showcase bên phải
  const cardProfile = document.querySelector('#cardProfile');
  const cardGuardrail = document.querySelector('#cardGuardrail');
  const cardRevenue = document.querySelector('#cardRevenue');

  if (cardProfile) cardProfile.addEventListener('click', () => openPreview('kh001'));
  if (cardGuardrail) cardGuardrail.addEventListener('click', () => openPreview('kh036'));
  if (cardRevenue) cardRevenue.addEventListener('click', () => openPreview('revenue'));

  // Gán sự kiện click cho Dải số liệu bảo chứng (Proof Bar)
  const proofContracts = document.querySelector('#proofContracts');
  const proofHitl = document.querySelector('#proofHitl');
  const proofStaging = document.querySelector('#proofStaging');
  const proofRevenue = document.querySelector('#proofRevenue');

  if (proofContracts) proofContracts.addEventListener('click', () => openPreview('throughput'));
  if (proofHitl) proofHitl.addEventListener('click', () => hitlDialog?.showModal());
  if (proofStaging) proofStaging.addEventListener('click', () => openPreview('staging'));
  if (proofRevenue) proofRevenue.addEventListener('click', () => openPreview('revenue'));

  // 6. Hiệu ứng 3D Parallax Tilt theo chuột (Poe AI Style)
  const introRight = document.querySelector('.intro-right');
  if (introRight && cardsCanvas && window.matchMedia('(min-width: 900px)').matches) {
    introRight.addEventListener('mousemove', (e) => {
      if (isTransitioning) return;
      const rect = introRight.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const tiltX = -(y / rect.height) * 10;
      const tiltY = (x / rect.width) * 10;

      cardsCanvas.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    });

    introRight.addEventListener('mouseleave', () => {
      cardsCanvas.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
      cardsCanvas.style.transition = 'transform 0.4s ease-out';
    });

    introRight.addEventListener('mouseenter', () => {
      cardsCanvas.style.transition = 'transform 0.1s ease-out';
    });
  }

  // 7. Khởi tạo trạng thái ban đầu theo URL hash
  if (window.location.hash === '#workflow') {
    workspaceShell.classList.remove('is-hidden');
    workspaceShell.classList.add('is-active');
    introScreen.classList.add('is-hidden');
  } else {
    workspaceShell.classList.add('is-hidden');
    workspaceShell.classList.remove('is-active');
    introScreen.classList.remove('is-hidden');
  }
})();
