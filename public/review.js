/**
 * ==============================================================================
 * AN TÍN RENEWAL AGENT - BỘ QUẢN LÝ DUYỆT HỒ SƠ & TÁC NGHIỆP THỰC TẾ
 * Bổ sung:
 * 1. Tag màu cảnh báo hạn hợp đồng (Đỏ <15 ngày / Vàng 15-45 ngày / Xanh >45 ngày)
 * 2. Bộ lọc khẩn cấp theo mốc thời gian (Urgency Filter Pills)
 * 3. 1-Click Sao chép Email B2B (AI soạn sẵn cá nhân hóa) kèm Toast thông báo
 * ==============================================================================
 */

const reviewState = {
  query: '',
  filter: 'all',
  urgencyFilter: 'all',
  page: 0,
  selected: new Set(),
  finalKeys: null,
  approved: new Set(),
  view: 'pending'
};

const reviewGroups = {
  upgrade: { label: 'Xem xét nâng gói', icon: '↗', note: 'Sử dụng cao, không có ticket mở' },
  renew: { label: 'Giữ gói hiện tại', icon: '↻', note: 'Theo đề xuất gia hạn hiện tại' },
  blocked: { label: 'Chặn upsell', icon: '!', note: 'Cần ưu tiên xử lý sự cố' },
  verify: { label: 'Cần xác minh', icon: '?', note: 'Còn thông tin cần bổ sung' }
};

let reviewSearchTimer;

function resetReview() {
  clearTimeout(reviewSearchTimer);
  reviewState.query = '';
  reviewState.filter = 'all';
  reviewState.urgencyFilter = 'all';
  reviewState.page = 0;
  reviewState.selected = new Set();
  reviewState.finalKeys = null;
  reviewState.approved = new Set();
  reviewState.view = 'pending';
  if(typeof resetEmailDrafts==='function')resetEmailDrafts();
}

function reviewKey(row) {
  return JSON.stringify([String(row.customer_id ?? ''), String(row.contract_id ?? '')]);
}

function reviewGroup(row) {
  if (row.status === 'Chặn upsell' || row.open_tickets > 0) return 'blocked';
  if (row.status === 'Cần xác minh' || row.adoption_rate == null || row.open_tickets == null || row.renewal_value == null) return 'verify';
  return row.recommendation === 'Xem xét nâng gói' ? 'upgrade' : 'renew';
}

/**
 * Tính mức độ khẩn cấp (SLA Urgency) theo ngày hết hạn hợp đồng
 */
function getUrgency(expirationDateStr) {
  if (!expirationDateStr) {
    return { level: 'unknown', label: 'Chưa rõ hạn', badgeClass: 'urgency-unknown', daysText: 'Chưa có ngày' };
  }
  const exp = new Date(expirationDateStr);
  if (isNaN(exp.getTime())) {
    return { level: 'unknown', label: 'Chưa rõ hạn', badgeClass: 'urgency-unknown', daysText: 'Sai định dạng' };
  }
  let now = new Date();
  if (Math.abs(now.getFullYear() - exp.getFullYear()) > 1) {
    now = new Date(exp.getFullYear(), 10, 12);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { level: 'danger', label: 'Quá hạn', badgeClass: 'urgency-danger', daysText: `Quá hạn ${Math.abs(diffDays)} ngày` };
  }
  if (diffDays <= 15) {
    return { level: 'danger', label: 'Khẩn cấp', badgeClass: 'urgency-danger', daysText: `Còn ${diffDays} ngày` };
  }
  if (diffDays <= 45) {
    return { level: 'warning', label: 'Điểm vàng', badgeClass: 'urgency-warning', daysText: `Còn ${diffDays} ngày` };
  }
  return { level: 'safe', label: 'Dài hạn', badgeClass: 'urgency-safe', daysText: `Còn ${diffDays} ngày` };
}

/**
 * Tự động tạo bản nháp email B2B chuẩn văn phong chuyên nghiệp cá nhân hóa theo từng hồ sơ
 */
function generateEmailDraft(row) {
  return emailDraftFor(row).body;
}

function reviewBaseRows() {
  const rows = state.analysis?.rows || [];
  if (reviewState.view === 'approved') return rows.filter(row => reviewState.approved.has(reviewKey(row)));
  return rows.filter(row => !reviewState.approved.has(reviewKey(row)) && (state.step !== 4 || reviewState.finalKeys?.has(reviewKey(row))));
}

function setReviewView(view) {
  reviewState.view = view === 'approved' ? 'approved' : 'pending';
  reviewState.selected.clear();
  reviewState.query = '';
  reviewState.filter = 'all';
  reviewState.urgencyFilter = 'all';
  reviewState.page = 0;
  clearTimeout(reviewSearchTimer);
  refreshReviewWorkspace();
}

function searchKey(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function reviewFilteredRows() {
  const tokens = searchKey(reviewState.query).split(/\s+/).filter(Boolean);
  return reviewBaseRows().filter(row => {
    const searchable = searchKey(`${row.customer_id} ${row.contract_id} ${row.customer_name}`);
    const matchesGroup = (reviewState.filter === 'all' || reviewGroup(row) === reviewState.filter);
    const matchesUrgency = (reviewState.urgencyFilter === 'all' || getUrgency(row.expiration_date).level === reviewState.urgencyFilter);
    return matchesGroup && matchesUrgency && tokens.every(token => searchable.includes(token));
  });
}

function selectedReviewRows() {
  return reviewBaseRows().filter(row => reviewState.selected.has(reviewKey(row)));
}

function reviewPageRows() {
  const rows = reviewFilteredRows(), pages = Math.max(1, Math.ceil(rows.length / 50));
  reviewState.page = Math.max(0, Math.min(reviewState.page, pages - 1));
  return rows.slice(reviewState.page * 50, reviewState.page * 50 + 50);
}

function selectReviewRows(rows, checked) {
  for (const row of rows) {
    const id = reviewKey(row);
    checked ? reviewState.selected.add(id) : reviewState.selected.delete(id);
  }
}

function adoptionVisual(row) {
  if (row.adoption_rate == null) return '<span class="review-missing">Chưa có dữ liệu</span>';
  const percent = Math.max(0, Math.min(100, Number(row.adoption_rate) || 0));
  return `<div class="adoption-visual"><span>${esc(row.adoption_rate)}%</span><span class="adoption-track" aria-hidden="true"><i style="width:${percent}%"></i></span></div>`;
}

function reviewTable() {
  const rows = reviewFilteredRows(), pageRows = reviewPageRows(), start = reviewState.page * 50;
  const allPage = pageRows.length > 0 && pageRows.every(row => reviewState.selected.has(reviewKey(row)));

  return `<div class="table-wrap review-table-wrap"><table class="data-table review-table"><thead><tr><th class="review-checkbox-cell" scope="col"><input type="checkbox" id="reviewSelectPage" data-review-select-page ${allPage ? 'checked' : ''} ${!pageRows.length ? 'disabled' : ''} aria-label="Chọn hoặc bỏ chọn các hồ sơ trên trang này"></th><th scope="col">Mã khách / Hợp đồng</th><th scope="col">Khách hàng</th><th scope="col">Gói hiện tại</th><th scope="col">Hết hạn / Mức khẩn cấp</th><th scope="col">Mức sử dụng</th><th scope="col">Ticket mở</th><th scope="col">Đề xuất & Căn cứ / Email</th><th scope="col">Giá trị gia hạn</th></tr></thead><tbody>${pageRows.map(row => {
    const group = reviewGroup(row), config = reviewGroups[group], checked = reviewState.selected.has(reviewKey(row));
    const urgency = getUrgency(row.expiration_date);
    const emailDraft = generateEmailDraft(row);

    return `<tr class="proposal-row proposal-${group} ${checked ? 'is-selected' : ''}">
      <td class="review-checkbox-cell"><input type="checkbox" data-review-key="${esc(reviewKey(row))}" ${checked ? 'checked' : ''} aria-label="Chọn hợp đồng ${esc(row.contract_id)} của khách ${esc(row.customer_id)}"></td>
      <td class="review-key-cell"><strong>${esc(row.customer_id)}</strong><small>${esc(row.contract_id)}</small></td>
      <td class="review-customer">${esc(row.customer_name)}</td>
      <td>${esc(row.plan)}</td>
      <td class="review-dates">
        <div class="urgency-badge ${urgency.badgeClass}" title="${esc(urgency.label)}: ${esc(urgency.daysText)}">
          <span class="urgency-dot"></span>
          <span>${esc(urgency.label)} · ${esc(urgency.daysText)}</span>
        </div>
        <span>${esc(row.expiration_date)}</span>
        <small>Liên hệ: ${esc(row.outreach_date)}</small>
      </td>
      <td>${adoptionVisual(row)}</td>
      <td><span class="ticket-number ${row.open_tickets > 0 ? 'has-tickets' : ''}">${esc(row.open_tickets ?? 'Chưa rõ')}</span></td>
      <td class="proposal-cell">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
          <span class="proposal-badge ${group}"><b>${config.icon}</b>${config.label}</span>
          <button type="button" class="btn-copy-email" data-copy-email-key="${esc(reviewKey(row))}" title="Xem trước, chỉnh sửa hoặc yêu cầu Agent viết lại email">✉ Xem email</button>
        </div>
        <details class="proposal-evidence">
          <summary>Xem căn cứ & bản nháp Email</summary>
          <p>${esc(row.reason || 'Chưa có lý do chi tiết.')}</p>
          <small>${esc(row.policy_status || 'Chính sách cần được người duyệt xác nhận.')}</small>
          <div class="row-email-preview">
            <div class="row-email-header">
              <strong>✉ Bản nháp Email B2B (AI soạn sẵn):</strong>
              <button type="button" class="btn-copy-email" data-copy-email-key="${esc(reviewKey(row))}">✉ Xem & chỉnh email</button>
            </div>
            <pre class="row-email-text" data-email-preview-key="${esc(reviewKey(row))}">${esc(emailDraft)}</pre>
          </div>
        </details>
      </td>
      <td class="review-money">${esc(money(row.renewal_value))}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" class="review-empty">${reviewBaseRows().length ? 'Không có hồ sơ khớp mã hoặc bộ lọc. Thử xóa tìm kiếm hoặc chọn nhóm khác.' : reviewState.view === 'approved' ? 'Chưa có hồ sơ đã duyệt trong phiên kết quả này.' : state.step === 4 ? 'Đã xử lý hết hồ sơ trong lượt duyệt này. Bạn có thể chọn thêm hồ sơ hoặc xem mục Đã duyệt.' : 'Không còn hồ sơ chờ duyệt trong phiên kết quả này.'}</td></tr>`}</tbody></table></div>
  <div class="table-pagination"><span>${rows.length ? fmtNum(start + 1) : 0}–${fmtNum(Math.min(start + 50, rows.length))} / ${fmtNum(rows.length)} hồ sơ phù hợp</span><div class="pagination-actions"><button class="btn btn-light" data-review-page="${reviewState.page - 1}" ${reviewState.page === 0 ? 'disabled' : ''} aria-label="Trang hồ sơ trước">←</button><button class="btn btn-light" data-review-page="${reviewState.page + 1}" ${start + 50 >= rows.length ? 'disabled' : ''} aria-label="Trang hồ sơ sau">→</button></div></div>`;
}

function reviewSelectionSummary() {
  const selected = selectedReviewRows(), visibleKeys = new Set(reviewFilteredRows().map(reviewKey));
  const hidden = selected.filter(row => !visibleKeys.has(reviewKey(row))).length;
  return `<div><strong>Đã chọn ${fmtNum(selected.length)} / ${fmtNum(reviewBaseRows().length)} hồ sơ</strong><small>${hidden ? `${fmtNum(hidden)} hồ sơ đã chọn nằm ngoài bộ lọc hiện tại. ` : ''}Bấm vào dòng để chọn/bỏ chọn. Lựa chọn được giữ khi tìm kiếm, đổi nhóm và chuyển trang.</small></div><div class="review-bulk-actions"><button class="btn btn-light" data-review-bulk="filtered">Chọn tất cả kết quả lọc (${fmtNum(reviewFilteredRows().length)})</button><button class="btn btn-quiet" data-review-bulk="clear" ${!selected.length ? 'disabled' : ''}>Bỏ toàn bộ lựa chọn</button></div>`;
}

function reviewWorkspace() {
  const all = state.analysis?.rows || [];
  const approvedCount = all.filter(row => reviewState.approved.has(reviewKey(row))).length;
  const pendingCount = all.filter(row => !reviewState.approved.has(reviewKey(row)) && (state.step !== 4 || reviewState.finalKeys?.has(reviewKey(row)))).length;

  const allRows = reviewBaseRows();
  const dangerCount = allRows.filter(r => getUrgency(r.expiration_date).level === 'danger').length;
  const warningCount = allRows.filter(r => getUrgency(r.expiration_date).level === 'warning').length;
  const safeCount = allRows.filter(r => getUrgency(r.expiration_date).level === 'safe').length;

  // Tính số lượng hồ sơ theo từng nhóm đề xuất
  const groupCounts = { all: allRows.length, upgrade: 0, renew: 0, blocked: 0, verify: 0 };
  allRows.forEach(row => groupCounts[reviewGroup(row)]++);

  return `<section id="reviewWorkspace" class="review-workspace" aria-label="Chọn và kiểm duyệt hồ sơ">
    <div class="approval-queues" role="group" aria-label="Trạng thái duyệt">
      <button class="approval-queue ${reviewState.view === 'pending' ? 'active' : ''}" data-review-view="pending" aria-pressed="${reviewState.view === 'pending'}">Chờ duyệt <b>${fmtNum(pendingCount)}</b></button>
      <button class="approval-queue ${reviewState.view === 'approved' ? 'active' : ''}" data-review-view="approved" aria-pressed="${reviewState.view === 'approved'}">✓ Đã duyệt <b>${fmtNum(approvedCount)}</b></button>
      <span>${reviewState.view === 'approved' ? 'Hồ sơ đã duyệt được lưu để xem lại và tải kết quả.' : 'Hồ sơ sẽ tự ẩn khỏi danh sách này sau khi duyệt cuối.'}</span>
    </div>

    <!-- KHỐI NHÓM ĐỀ XUẤT ĐẦU TRANG THEO YÊU CẦU NGƯỜI DÙNG -->
    <div class="top-proposal-groups" role="toolbar" aria-label="Lọc nhanh theo nhóm đề xuất">
      <div class="top-groups-header">
        <div class="top-groups-label">
          <span class="top-groups-badge">PHÂN LOẠI AI</span>
          <strong>NHÓM ĐỀ XUẤT GIA HẠN</strong>
        </div>
        <small class="top-groups-hint">Bấm vào từng nhóm để xem danh sách tương ứng · Bấm lại để xem tất cả</small>
      </div>

      <div class="top-groups-grid">
        <button type="button" class="top-group-card all ${reviewState.filter === 'all' ? 'active' : ''}" data-review-filter="all" aria-pressed="${reviewState.filter === 'all'}" title="Xem tất cả nhóm đề xuất">
          <div class="top-group-top">
            <span class="group-dot"></span>
            <span class="group-name">Tất cả nhóm</span>
          </div>
          <div class="top-group-bottom">
            <strong class="group-count">${fmtNum(groupCounts.all)}</strong>
            <span class="group-desc">Toàn bộ hồ sơ</span>
          </div>
        </button>

        <button type="button" class="top-group-card upgrade ${reviewState.filter === 'upgrade' ? 'active' : ''}" data-review-filter="upgrade" aria-pressed="${reviewState.filter === 'upgrade'}" title="${esc(reviewGroups.upgrade.note)}">
          <div class="top-group-top">
            <span class="group-dot"></span>
            <span class="group-name">↗ Xem xét nâng gói</span>
          </div>
          <div class="top-group-bottom">
            <strong class="group-count">${fmtNum(groupCounts.upgrade)}</strong>
            <span class="group-desc">Sử dụng ≥85%, 0 ticket</span>
          </div>
        </button>

        <button type="button" class="top-group-card renew ${reviewState.filter === 'renew' ? 'active' : ''}" data-review-filter="renew" aria-pressed="${reviewState.filter === 'renew'}" title="${esc(reviewGroups.renew.note)}">
          <div class="top-group-top">
            <span class="group-dot"></span>
            <span class="group-name">↻ Giữ gói hiện tại</span>
          </div>
          <div class="top-group-bottom">
            <strong class="group-count">${fmtNum(groupCounts.renew)}</strong>
            <span class="group-desc">Tái ký gói đang dùng</span>
          </div>
        </button>

        <button type="button" class="top-group-card blocked ${reviewState.filter === 'blocked' ? 'active' : ''}" data-review-filter="blocked" aria-pressed="${reviewState.filter === 'blocked'}" title="${esc(reviewGroups.blocked.note)}">
          <div class="top-group-top">
            <span class="group-dot"></span>
            <span class="group-name">🛑 Chặn upsell</span>
          </div>
          <div class="top-group-bottom">
            <strong class="group-count">${fmtNum(groupCounts.blocked)}</strong>
            <span class="group-desc">Ưu tiên xử lý sự cố</span>
          </div>
        </button>

        <button type="button" class="top-group-card verify ${reviewState.filter === 'verify' ? 'active' : ''}" data-review-filter="verify" aria-pressed="${reviewState.filter === 'verify'}" title="${esc(reviewGroups.verify.note)}">
          <div class="top-group-top">
            <span class="group-dot"></span>
            <span class="group-name">❓ Cần xác minh</span>
          </div>
          <div class="top-group-bottom">
            <strong class="group-count">${fmtNum(groupCounts.verify)}</strong>
            <span class="group-desc">Thiếu log / thông tin</span>
          </div>
        </button>
      </div>
    </div>

    ${reviewState.view === 'approved' ? '<div class="approved-downloads"><button class="btn btn-light" data-approved-export="csv">↓ Tải CSV đã chọn</button><button class="btn btn-light" data-approved-export="html">↓ Tải HTML đã chọn</button><small>Tích hồ sơ đã duyệt để tải lại kết quả.</small></div>' : ''}

    <div class="review-toolbar">
      <label class="review-search-label" for="reviewSearch">
        Tìm theo khóa chính hoặc tên khách hàng
        <input type="search" id="reviewSearch" placeholder="VD: KH001 hoặc HD-2026-001" value="${esc(reviewState.query)}" autocomplete="off">
      </label>
      <button class="btn btn-quiet" data-review-reset-filters>Xóa bộ lọc</button>
    </div>

    <!-- Dải Lọc mức độ khẩn cấp theo hạn hợp đồng (SLA Urgency Filter Bar) -->
    <div class="urgency-filters-bar">
      <span style="font-size:11px; font-weight:700; color:var(--workspace-muted); margin-right:4px;">Hạn hợp đồng:</span>
      <button type="button" class="urgency-filter-btn ${reviewState.urgencyFilter === 'all' ? 'active' : ''}" data-urgency-filter="all">Tất cả (${fmtNum(allRows.length)})</button>
      <button type="button" class="urgency-filter-btn ${reviewState.urgencyFilter === 'danger' ? 'active' : ''}" data-urgency-filter="danger" title="Hợp đồng hết hạn dưới 15 ngày hoặc đã quá hạn"><span class="urgency-dot" style="background:#d63324;"></span>🔴 Khẩn cấp &lt;15 ngày (${fmtNum(dangerCount)})</button>
      <button type="button" class="urgency-filter-btn ${reviewState.urgencyFilter === 'warning' ? 'active' : ''}" data-urgency-filter="warning" title="Hợp đồng trong khung thời gian vàng 15-45 ngày"><span class="urgency-dot" style="background:#c98516;"></span>🟡 Điểm vàng 15-45 ngày (${fmtNum(warningCount)})</button>
      <button type="button" class="urgency-filter-btn ${reviewState.urgencyFilter === 'safe' ? 'active' : ''}" data-urgency-filter="safe" title="Hợp đồng còn trên 45 ngày"><span class="urgency-dot" style="background:#477c33;"></span>🟢 Dài hạn &gt;45 ngày (${fmtNum(safeCount)})</button>
    </div>

    <div class="review-selection-bar" id="reviewSelectionSummary" aria-live="polite">${reviewSelectionSummary()}</div>
    <div id="reviewTableHost">${reviewTable()}</div>
  </section>`;
}

function syncReviewActions() {
  if (![3, 4].includes(state.step)) return;
  updateDashboard();
  const rows = selectedReviewRows(), busy = state.processing;
  const transfer = document.querySelector('#reviewOutput');
  if (transfer) {
    transfer.disabled = !rows.length || busy || reviewState.view !== 'pending';
    transfer.textContent = reviewState.view === 'approved' ? 'Các hồ sơ này đã được duyệt' : `Chuyển duyệt ${fmtNum(rows.length)} hồ sơ →`;
  }
  for (const id of ['exportHtml', 'exportCsv']) {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = !rows.length || busy;
      button.textContent = reviewState.view === 'approved' ? (id === 'exportHtml' ? 'Tải HTML đã duyệt' : 'Tải CSV đã duyệt') : (id === 'exportHtml' ? 'Duyệt & xuất HTML' : '✓ Duyệt & xuất CSV');
    }
  }
  const approve = document.querySelector('#approveSelected');
  if (approve) {
    approve.hidden = reviewState.view === 'approved';
    approve.disabled = !rows.length || busy;
    approve.textContent = `✓ Duyệt ${fmtNum(rows.length)} hồ sơ`;
  }
  document.querySelectorAll('[data-approved-export]').forEach(button => { button.disabled = !rows.length || busy; });
  const note = document.querySelector('#finalSelectionSummary');
  if (note) {
    const priced = rows.filter(row => row.renewal_value != null);
    note.textContent = `Đang chọn ${fmtNum(rows.length)} hồ sơ ${reviewState.view === 'approved' ? 'đã duyệt để tải lại' : 'để duyệt và xuất'}. Giá trị có căn cứ: ${money(priced.reduce((sum, row) => sum + row.renewal_value, 0))} (${fmtNum(priced.length)} hồ sơ có giá).`;
  }
  const checkbox = document.querySelector('#reviewSelectPage');
  if (checkbox) {
    const page = reviewPageRows(), checked = page.filter(row => reviewState.selected.has(reviewKey(row))).length;
    checkbox.checked = page.length > 0 && checked === page.length;
    checkbox.indeterminate = checked > 0 && checked < page.length;
  }
}

function refreshReviewSelection() {
  document.querySelectorAll('.review-table [data-review-key]').forEach(checkbox => {
    checkbox.checked = reviewState.selected.has(checkbox.dataset.reviewKey);
    checkbox.closest('tr.proposal-row')?.classList.toggle('is-selected', checkbox.checked);
  });
  document.querySelector('#reviewSelectionSummary').innerHTML = reviewSelectionSummary();
  syncReviewActions();
}

function refreshReviewTable({resetScroll=false}={}) {
  if (![3, 4].includes(state.step)) return;
  const stageScroll=stageEl.scrollTop;
  const previousTable=document.querySelector('#reviewTableHost .review-table-wrap');
  const tableTop=resetScroll?0:previousTable?.scrollTop || 0,tableLeft=previousTable?.scrollLeft || 0;
  document.querySelector('#reviewTableHost').innerHTML = reviewTable();
  document.querySelector('#reviewSelectionSummary').innerHTML = reviewSelectionSummary();
  syncReviewActions();
  const table=document.querySelector('#reviewTableHost .review-table-wrap');
  if(table){table.scrollTop=tableTop;table.scrollLeft=tableLeft;}
  stageEl.scrollTop=stageScroll;
}

function refreshReviewWorkspace() {
  if (![3, 4].includes(state.step)) return;
  const stageScroll=stageEl.scrollTop;
  document.querySelector('#reviewWorkspace').outerHTML = reviewWorkspace();
  syncReviewActions();
  stageEl.scrollTop=stageScroll;
}

function refreshReviewFilters() {
  // Keep the clicked control and search input mounted so focus and hover stay put.
  document.querySelectorAll('#reviewWorkspace [data-review-filter]').forEach(button=>{
    const active=button.dataset.reviewFilter===reviewState.filter;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
  document.querySelectorAll('#reviewWorkspace [data-urgency-filter]').forEach(button=>{
    const active=button.dataset.urgencyFilter===reviewState.urgencyFilter;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
  refreshReviewTable({resetScroll:true});
}

function setReviewFilter(group) {
  if (!['all', ...Object.keys(reviewGroups)].includes(group) || ![3, 4].includes(state.step) || state.processing) return;
  reviewState.filter = group === reviewState.filter ? 'all' : group;
  reviewState.page = 0;
  refreshReviewFilters();
}

function setUrgencyFilter(level) {
  if (!['all', 'danger', 'warning', 'safe'].includes(level) || ![3, 4].includes(state.step) || state.processing) return;
  reviewState.urgencyFilter = level;
  reviewState.page = 0;
  refreshReviewFilters();
}

function transferReviewSelection() {
  const rows = selectedReviewRows();
  if (!rows.length || state.processing || reviewState.view !== 'pending') return;
  reviewState.finalKeys = new Set(rows.map(reviewKey));
  reviewState.query = '';
  reviewState.filter = 'all';
  reviewState.urgencyFilter = 'all';
  reviewState.page = 0;
  state.feedback = document.querySelector('#analysisFeedback')?.value?.trim() ?? state.drafts.analysis ?? state.feedback;
  pushAudit('review_selection', `Chuyển ${rows.length} hồ sơ đã chọn sang duyệt cuối.`);
  setStep(4);
}

function markReviewApproved(rows) {
  for (const row of rows) {
    const key = reviewKey(row);
    reviewState.approved.add(key);
    reviewState.selected.delete(key);
  }
  refreshReviewWorkspace();
}

function approveReviewSelection() {
  if (state.step !== 4 || state.processing || reviewState.view !== 'pending') return;
  const rows = selectedReviewRows();
  if (!rows.length) return;
  pushAudit('human_approval', `Đã duyệt ${rows.length} hồ sơ, chuyển khỏi danh sách chờ duyệt. Khóa mẫu: ${rows.slice(0, 20).map(row => `${row.customer_id}/${row.contract_id}`).join(', ')}`);
  markReviewApproved(rows);
  document.querySelector('#reviewExportNotice').textContent = `Đã duyệt ${rows.length} hồ sơ và ẩn khỏi danh sách chờ. Mở mục Đã duyệt để xem lại hoặc tải kết quả.`;
  if (typeof window.showToast === 'function') {
    window.showToast(`✓ Đã phê duyệt thành công ${rows.length} hồ sơ gia hạn!`);
  }
}

function exportReviewSelection(format) {
  if ((state.step !== 4 && !(state.step === 3 && reviewState.view === 'approved')) || state.processing) return;
  const rows = selectedReviewRows();
  if (!rows.length) return;
  const alreadyApproved = reviewState.view === 'approved';
  format === 'html' ? exportHtml(rows) : exportCsv(rows);
  pushAudit(alreadyApproved ? 'approved_export' : 'human_approval', `${alreadyApproved ? 'Tải lại' : 'Đã duyệt và xuất'} ${rows.length} hồ sơ được chọn (${format.toUpperCase()}). Khóa mẫu: ${rows.slice(0, 20).map(row => `${row.customer_id}/${row.contract_id}`).join(', ')}${rows.length > 20 ? '…' : ''}`);
  if (!alreadyApproved) markReviewApproved(rows);
  document.querySelector('#reviewExportNotice').textContent = alreadyApproved ? `Đã tải lại kết quả của ${rows.length} hồ sơ đã duyệt.` : `Đã duyệt và xuất ${rows.length} hồ sơ; các hồ sơ này đã ẩn khỏi danh sách chờ và được giữ trong mục Đã duyệt.`;
  if (typeof window.showToast === 'function') {
    window.showToast(`✓ Đã xuất file ${format.toUpperCase()} cho ${rows.length} hồ sơ!`);
  }
}

stageEl.addEventListener('input', event => {
  if (event.target.id !== 'reviewSearch') return;
  reviewState.query = event.target.value;
  reviewState.page = 0;
  clearTimeout(reviewSearchTimer);
  reviewSearchTimer = setTimeout(refreshReviewTable, 150);
});

stageEl.addEventListener('change', event => {
  if (![3, 4].includes(state.step) || state.processing) return;
  const checkbox = event.target;
  if (checkbox.matches('[data-review-key]')) {
    const key = checkbox.dataset.reviewKey;
    if (!reviewBaseRows().some(row => reviewKey(row) === key)) return;
    checkbox.checked ? reviewState.selected.add(key) : reviewState.selected.delete(key);
    refreshReviewSelection();
  } else if (checkbox.matches('[data-review-select-page]')) {
    selectReviewRows(reviewPageRows(), checkbox.checked);
    refreshReviewSelection();
  }
});

stageEl.addEventListener('click', event => {
  if (![3, 4].includes(state.step) || state.processing || state.uploading || event.button > 0) return;

  // Bắt sự kiện nút Sao chép Email B2B
  const copyBtn = event.target.closest('[data-copy-email-key]');
  if (copyBtn) {
    event.stopPropagation();
    event.preventDefault();
    const key = copyBtn.dataset.copyEmailKey;
    const row = reviewBaseRows().find(r => reviewKey(r) === key);
    if (row) openContractEmail(key);
    return;
  }

  // Bắt sự kiện bấm nút lọc mức độ khẩn cấp (Urgency filter)
  const urgencyBtn = event.target.closest('[data-urgency-filter]');
  if (urgencyBtn) {
    event.stopPropagation();
    setUrgencyFilter(urgencyBtn.dataset.urgencyFilter);
    return;
  }

  // Bỏ qua nếu click vào các điều khiển form hoặc chi tiết
  if (event.target.closest('input,label,button,a,summary,details,select,textarea,[contenteditable]')) return;
  if (typeof window !== 'undefined' && window.getSelection?.()?.isCollapsed === false) return;

  const row = event.target.closest('tr.proposal-row');
  const checkbox = row?.querySelector('input[data-review-key]');
  if (checkbox && !checkbox.disabled) checkbox.click();
});

stageEl.addEventListener('click', event => {
  const button = event.target.closest('[data-review-filter],[data-review-page],[data-review-bulk],[data-review-reset-filters],[data-review-view],[data-approved-export]');
  if (!button || button.disabled || ![3, 4].includes(state.step) || state.processing) return;
  if (button.hasAttribute('data-review-view')) {
    setReviewView(button.dataset.reviewView);
  } else if (button.hasAttribute('data-approved-export')) {
    exportReviewSelection(button.dataset.approvedExport);
  } else if (button.hasAttribute('data-review-filter')) {
    setReviewFilter(button.dataset.reviewFilter);
  } else if (button.hasAttribute('data-review-reset-filters')) {
    reviewState.query = '';
    reviewState.filter = 'all';
    reviewState.urgencyFilter = 'all';
    reviewState.page = 0;
    document.querySelector('#reviewSearch').value='';
    refreshReviewFilters();
  } else if (button.hasAttribute('data-review-page')) {
    reviewState.page = Number(button.dataset.reviewPage);
    refreshReviewTable({resetScroll:true});
  } else if (button.dataset.reviewBulk === 'filtered') {
    selectReviewRows(reviewFilteredRows(), true);
    refreshReviewSelection();
  } else {
    reviewState.selected.clear();
    refreshReviewSelection();
  }
});
