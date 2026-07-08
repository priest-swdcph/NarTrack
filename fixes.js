(function () {
  const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzOITprKzWcOhvgl6ELltxJmhGEjCifJA0ZwdDgqba-gKTP1hswlcnRa1Lithqx6fIs/exec";

  if (!localStorage.getItem("GAS_API_URL")) {
    localStorage.setItem("GAS_API_URL", DEFAULT_API_URL);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH") + " " + date.toLocaleTimeString("th-TH");
  }

  function formatShortDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH");
  }

  function populateDisbursementDropdown(stockList) {
    const select = document.getElementById("disburse-stock-select");
    if (!select) return;

    const currentValue = select.value;
    const rows = Array.isArray(stockList) ? stockList.filter(item => parseFloat(item.QtyRemain || 0) > 0) : [];

    let html = '<option value="" disabled selected>-- เลือกยาและล็อตจากคลัง --</option>';
    if (rows.length === 0) {
      html = '<option value="" disabled selected>-- ไม่พบรายการคงเหลือ --</option>';
    } else {
      rows.forEach(item => {
        const text = `${item.DrugName || "-"} | LOT ${item.LOT || "-"} | คงเหลือ ${item.QtyRemain ?? 0}`;
        html += `<option value="${escapeHtml(item.StockID)}">${escapeHtml(text)}</option>`;
      });
    }

    select.innerHTML = html;
    if (currentValue) {
      select.value = currentValue;
    }
  }

  function renderDisbursementTable(rows) {
    const tbody = document.getElementById("disbursement-tbody");
    if (!tbody) return;

    if (window.__disbursementTable && typeof window.__disbursementTable.destroy === "function") {
      window.__disbursementTable.destroy();
      window.__disbursementTable = null;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ยังไม่มีประวัติการตัดจ่ายยา</td></tr>';
    } else {
      tbody.innerHTML = rows.map(item => `
        <tr>
          <td><span class="fw-semibold text-primary">${escapeHtml(item.DisburseID || item.DrugName || "-")}</span></td>
          <td class="fw-semibold">${escapeHtml(item.DrugName || "-")}</td>
          <td><span class="badge bg-secondary">${escapeHtml(item.LOT || "-")}</span></td>
          <td>${escapeHtml(item.PatientName || "-")} <span class="text-muted">(${escapeHtml(item.HN || "-")})</span></td>
          <td class="text-end fw-bold">${escapeHtml(item.Qty ?? 0)}</td>
          <td>${escapeHtml(item.User || "-")}</td>
          <td>${formatDateTime(item.Timestamp || item.Date)}</td>
        </tr>
      `).join("");
    }

    window.__disbursementTable = $("#disbursement-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 10,
      responsive: true
    });
  }

  function renderNavbar(activePage) {
    const placeholder = document.getElementById("navbar-placeholder");
    if (!placeholder) return;

    placeholder.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-dark navbar-custom sticky-top">
        <div class="container-fluid">
          <a class="navbar-brand d-flex align-items-center gap-2" href="dashboard.html">
            <img src="icon-app.png" alt="App Icon" class="app-brand-logo">
            <span>
              <span class="d-block">ระบบตรวจนับและตัดจ่ายยาเสพติด</span>
              <small class="fw-normal opacity-75">หอสงฆ์อาพาธ โรงพยาบาลสมเด็จพระยุพราชสว่างแดนดิน</small>
            </span>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0 nav-scroll-x">
              <li class="nav-item"><a class="nav-link" id="nav-dashboard" href="dashboard.html"><i class="fas fa-chart-line me-1"></i> แดชบอร์ด</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-stock" href="stock.html"><i class="fas fa-boxes-stacked me-1"></i> รับเข้า</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-disbursement" href="disbursement.html"><i class="fas fa-file-medical me-1"></i> ตัดจ่าย</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-shiftcount" href="shiftcount.html"><i class="fas fa-clipboard-check me-1"></i> ตรวจนับ</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-report" href="report.html"><i class="fas fa-file-pdf me-1"></i> รายงาน</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-settings" href="settings.html"><i class="fas fa-sliders me-1"></i> ตั้งค่ารายการ</a></li>
            </ul>
            <div class="d-flex align-items-center">
              <button class="btn btn-outline-light btn-sm" id="btn-config-api">
                <i class="fas fa-cog me-1"></i> ตั้งค่า API
              </button>
            </div>
          </div>
        </div>
      </nav>
    `;

    const activeNav = placeholder.querySelector(`#${activePage}`);
    if (activeNav) {
      activeNav.classList.add("active");
    }

    const btnConfigApi = document.getElementById("btn-config-api");
    if (btnConfigApi && !btnConfigApi.dataset.bound) {
      btnConfigApi.dataset.bound = "1";
      btnConfigApi.addEventListener("click", async function () {
        const { value: url } = await Swal.fire({
          title: 'ตั้งค่าการเชื่อมต่อ API',
          text: 'กรอก Google Apps Script Web App API URL สำหรับระบบ',
          input: 'text',
          inputValue: GASApi.getApiUrl(),
          inputPlaceholder: 'https://script.google.com/macros/s/.../exec',
          showCancelButton: true,
          confirmButtonText: 'บันทึก',
          cancelButtonText: 'ยกเลิก'
        });
        if (url) {
          GASApi.setApiUrl(url);
          showToast("บันทึก API URL เรียบร้อยแล้ว");
          window.location.reload();
        }
      });
    }
  }

  window.initLoginPage = function () {
    window.location.replace("dashboard.html");
  };

  window.loadNavbar = async function () {
    const page = window.location.pathname.split("/").pop();
    const activeMap = {
      "dashboard.html": "nav-dashboard",
      "stock.html": "nav-stock",
      "disbursement.html": "nav-disbursement",
      "shiftcount.html": "nav-shiftcount",
      "report.html": "nav-report",
      "settings.html": "nav-settings"
    };
    renderNavbar(activeMap[page] || "nav-dashboard");
  };

  window.initDisbursementPage = async function () {
    showLoading(true);

    try {
      const stockRes = await GASApi.getDrugStock();
      if (stockRes.success) {
        window.__disbursementStockCache = Array.isArray(stockRes.data) ? stockRes.data : [];
        populateDisbursementDropdown(window.__disbursementStockCache);
      } else {
        window.__disbursementStockCache = [];
      }

      const historyRes = await GASApi.getDisbursementReport("");
      if (historyRes.success) {
        renderDisbursementTable(historyRes.data || []);
      } else {
        renderDisbursementTable([]);
      }
    } catch (err) {
      console.error("Disbursement page error:", err);
      Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const stockSelect = document.getElementById("disburse-stock-select");
    const remainHint = document.getElementById("stock-remain-hint");
    const disburseUserInput = document.getElementById("disburse-user-input");
    if (disburseUserInput) {
      disburseUserInput.value = disburseUserInput.value || "เจ้าหน้าที่เวร";
    }
    if (stockSelect && remainHint && !stockSelect.dataset.bound) {
      stockSelect.dataset.bound = "1";
      stockSelect.addEventListener("change", function () {
        const selected = (window.__disbursementStockCache || []).find(item => item.StockID === this.value);
        if (selected) {
          remainHint.innerText = `คงเหลือในระบบ: ${selected.QtyRemain} ${selected.Unit || "หน่วย"}`;
        } else {
          remainHint.innerText = "คงเหลือในระบบ: -";
        }
      });
    }

    const disburseForm = document.getElementById("disburse-form");
    if (disburseForm && !disburseForm.dataset.bound) {
      disburseForm.dataset.bound = "1";
      disburseForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const stockID = document.getElementById("disburse-stock-select")?.value || "";
        const qty = parseFloat(document.getElementById("disburse-qty-input")?.value || "0");
        const patientName = document.getElementById("patient-name-input")?.value.trim() || "";
        const hn = document.getElementById("patient-hn-input")?.value.trim() || "";
        const user = document.getElementById("disburse-user-input")?.value.trim() || "";

        if (!stockID) {
          Swal.fire("แจ้งเตือน", "กรุณาเลือกรายการยาและล็อตก่อนตัดจ่าย", "warning");
          return;
        }
        if (!patientName || !hn || !user) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกข้อมูลผู้ป่วยและผู้จ่ายยาให้ครบถ้วน", "warning");
          return;
        }
        if (!qty || qty <= 0) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกจำนวนที่ต้องการจ่ายให้ถูกต้อง", "warning");
          return;
        }

        showLoading(true);
        try {
          const response = await GASApi.disburseDrug({
            StockID: stockID,
            Qty: qty,
            PatientName: patientName,
            HN: hn,
            User: user
          });
          showLoading(false);

          if (response.success) {
            const drugName = response.drugName || "รายการที่เลือก";
            const qtyRemain = response.qtyRemain ?? "-";
            Swal.fire({
              icon: "success",
              title: "ตัดจ่ายสำเร็จ",
              html: `ตัดจ่าย <b>${escapeHtml(drugName)}</b> จำนวน <b>${escapeHtml(qty)}</b> หน่วย<br>คงเหลือในระบบ: <b>${escapeHtml(qtyRemain)}</b> หน่วย`
            }).then(() => {
              disburseForm.reset();
              if (disburseUserInput) disburseUserInput.value = "เจ้าหน้าที่เวร";
              if (remainHint) remainHint.innerText = "คงเหลือในระบบ: -";
              window.initDisbursementPage();
            });
          } else {
            Swal.fire("เกิดข้อผิดพลาด", response.message || "ไม่สามารถตัดจ่ายยาได้", "error");
          }
        } catch (error) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", error.toString(), "error");
        }
      });
    }
  };

  window.renderStockTable = function (stockList) {
    const tbody = document.getElementById("stock-tbody");
    if (!tbody) return;

    if (window.__stockDataTable && typeof window.__stockDataTable.destroy === "function") {
      window.__stockDataTable.destroy();
      window.__stockDataTable = null;
    }

    const rows = Array.isArray(stockList) ? stockList : [];
    const today = new Date();

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">ยังไม่มีข้อมูลรับเข้ายา</td></tr>';
    } else {
      tbody.innerHTML = rows.map(item => {
        const remain = parseFloat(item.QtyRemain || 0);
        const expiryDate = item.ExpiryDate ? new Date(item.ExpiryDate) : null;
        let statusBadge = '<span class="badge bg-secondary">ปกติ</span>';

        if (remain <= 0) {
          statusBadge = '<span class="badge bg-secondary">หมดแล้ว</span>';
        } else if (expiryDate && !Number.isNaN(expiryDate.getTime())) {
          const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            statusBadge = '<span class="expiry-status-danger">หมดอายุ</span>';
          } else if (diffDays <= 30) {
            statusBadge = '<span class="expiry-status-warning">ใกล้หมดอายุ</span>';
          } else {
            statusBadge = '<span class="expiry-status-safe">ปกติ</span>';
          }
        }

        const fmtReceive = formatShortDate(item.ReceiveDate);
        const fmtExpiry = formatShortDate(item.ExpiryDate);

        return `
          <tr>
            <td><span class="fw-semibold text-primary">${escapeHtml(item.StockID || "-")}</span></td>
            <td>${escapeHtml(item.DrugName || "-")}</td>
            <td><span class="badge bg-secondary">${escapeHtml(item.LOT || "-")}</span></td>
            <td>${escapeHtml(fmtExpiry)}</td>
            <td>${escapeHtml(item.QtyReceive ?? 0)}</td>
            <td class="fw-bold">${escapeHtml(item.QtyRemain ?? 0)}</td>
            <td>${escapeHtml(fmtReceive)}</td>
            <td>${escapeHtml(item.CreatedBy || "-")}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join("");
    }

    window.__stockDataTable = $("#stock-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 10
    });
  };

  window.initStockPage = async function () {
    showLoading(true);
    try {
      const response = await GASApi.getDrugStock();
      if (response.success) {
        window.renderStockTable(response.data || []);
      } else {
        Swal.fire("เกิดข้อผิดพลาด", response.message || "ไม่สามารถดึงข้อมูลรับเข้าได้", "error");
      }
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const receiveDateInput = document.getElementById("receive-date-input");
    const createdByInput = document.getElementById("created-by-input");
    if (receiveDateInput) {
      receiveDateInput.value = new Date().toISOString().slice(0, 10);
    }
    if (createdByInput) {
      createdByInput.value = createdByInput.value || "เจ้าหน้าที่เวร";
    }

    const addStockForm = document.getElementById("add-stock-form");
    if (addStockForm && !addStockForm.dataset.bound) {
      addStockForm.dataset.bound = "1";
      addStockForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const qty = parseFloat(document.getElementById("qty-receive-input").value);
        if (!qty || qty <= 0) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกจำนวนรับเข้าที่ถูกต้อง", "warning");
          return;
        }

        const payload = {
          DrugName: document.getElementById("drug-name-input").value.trim(),
          Strength: document.getElementById("drug-strength-input").value.trim(),
          Unit: document.getElementById("drug-unit-input").value.trim(),
          LOT: document.getElementById("lot-input").value.trim(),
          ExpiryDate: document.getElementById("expiry-date-input").value,
          QtyReceive: qty,
          ReceiveDate: document.getElementById("receive-date-input").value,
          CreatedBy: document.getElementById("created-by-input").value.trim()
        };

        showLoading(true);
        try {
          const res = await GASApi.addDrugStock(payload);
          showLoading(false);
          if (res.success) {
            bootstrap.Modal.getInstance(document.getElementById("addStockModal"))?.hide();
            addStockForm.reset();
            if (receiveDateInput) receiveDateInput.value = new Date().toISOString().slice(0, 10);
            if (createdByInput) createdByInput.value = "เจ้าหน้าที่เวร";
            Swal.fire("บันทึกสำเร็จ", res.message || "บันทึกข้อมูลรับเข้าเรียบร้อยแล้ว", "success").then(() => {
              window.initStockPage();
            });
          } else {
            Swal.fire("บันทึกไม่สำเร็จ", res.message || "ไม่สามารถบันทึกข้อมูลรับเข้าได้", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
        }
      });
    }
  };

  window.populateShiftCountDrugs = function (masterList) {
    const select = document.getElementById("count-drug-select");
    if (!select) return;

    const rows = Array.isArray(masterList) ? masterList : [];
    let html = '<option value="" disabled selected>-- เลือกยา --</option>';
    rows.forEach(item => {
      const label = `${item.DrugName || "-"}${item.Strength ? ` (${item.Strength})` : ""}`;
      html += `<option value="${escapeHtml(item.DrugID)}">${escapeHtml(label)}</option>`;
    });
    select.innerHTML = html;
  };

  window.renderShiftCountTable = function (historyList) {
    const tbody = document.getElementById("shift-count-tbody");
    if (!tbody) return;

    if (window.__shiftCountTable && typeof window.__shiftCountTable.destroy === "function") {
      window.__shiftCountTable.destroy();
      window.__shiftCountTable = null;
    }

    const rows = Array.isArray(historyList) ? historyList : [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ยังไม่มีประวัติตรวจนับ</td></tr>';
    } else {
      tbody.innerHTML = rows.map(item => {
        const isCorrect = item.Result === "ถูกต้อง";
        const resultBadge = isCorrect
          ? '<span class="badge bg-success-subtle text-success px-2 py-1"><i class="fas fa-check me-1"></i>ถูกต้อง</span>'
          : '<span class="badge bg-danger-subtle text-danger px-2 py-1"><i class="fas fa-circle-exclamation me-1"></i>ไม่ตรง</span>';
        const fmtDate = formatShortDate(item.Date);
        return `
          <tr>
            <td>${escapeHtml(fmtDate)}</td>
            <td><span class="badge bg-primary">${escapeHtml(item.Shift || "-")}</span></td>
            <td>${escapeHtml(item.DrugName || "-")}</td>
            <td>${escapeHtml(item.AmpRemain ?? 0)}</td>
            <td>${escapeHtml(item.EmptyAmp ?? 0)}</td>
            <td class="fw-bold">${escapeHtml(item.ExpectedTotal ?? 0)}</td>
            <td>${resultBadge}</td>
            <td>${escapeHtml(item.User || "-")}</td>
          </tr>
        `;
      }).join("");
    }

    window.__shiftCountTable = $("#shift-count-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 5
    });
  };

  window.initShiftCountPage = async function () {
    showLoading(true);
    try {
      const masterRes = await GASApi.getDrugMaster();
      if (masterRes.success) {
        window.__masterCache = Array.isArray(masterRes.data) ? masterRes.data : [];
        window.populateShiftCountDrugs(window.__masterCache);
      } else {
        window.__masterCache = [];
      }

      const historyRes = await GASApi.getShiftCountHistory();
      if (historyRes.success) {
        window.renderShiftCountTable(historyRes.data || []);
      } else {
        window.renderShiftCountTable([]);
      }
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const drugSelect = document.getElementById("count-drug-select");
    const remainHint = document.getElementById("shift-remain-hint");
    const countUserInput = document.getElementById("count-user-input");
    if (countUserInput) {
      countUserInput.value = countUserInput.value || "เจ้าหน้าที่เวร";
    }
    if (drugSelect && remainHint && !drugSelect.dataset.bound) {
      drugSelect.dataset.bound = "1";
      drugSelect.addEventListener("change", function () {
        const selected = (window.__masterCache || []).find(item => item.DrugID === this.value);
        remainHint.innerText = selected
          ? `ยอดเป้าหมาย Stock Ward: ${selected.StockWard || 0} ${selected.Unit || "หน่วย"}`
          : "ยอดเป้าหมาย Stock Ward: -";
      });
    }

    const form = document.getElementById("shift-count-form");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const ampRemain = parseFloat(document.getElementById("amp-remain-input").value);
        const emptyAmp = parseFloat(document.getElementById("empty-amp-input").value);

        if (ampRemain < 0 || emptyAmp < 0 || Number.isNaN(ampRemain) || Number.isNaN(emptyAmp)) {
          Swal.fire("แจ้งเตือน", "ยอดนับห้ามเป็นค่าติดลบ", "warning");
          return;
        }
        if (!drugSelect?.value) {
          Swal.fire("แจ้งเตือน", "กรุณาเลือกชื่อยาที่ต้องการตรวจนับ", "warning");
          return;
        }

        showLoading(true);
        try {
          const res = await GASApi.saveShiftCount({
            Shift: document.getElementById("count-shift-select").value,
            DrugID: drugSelect.value,
            AmpRemain: ampRemain,
            EmptyAmp: emptyAmp,
            User: document.getElementById("count-user-input").value.trim()
          });
          showLoading(false);
          if (res.success) {
            const isCorrect = res.result === "ถูกต้อง";
            Swal.fire({
              icon: isCorrect ? "success" : "warning",
              title: isCorrect ? "บันทึกการตรวจนับสำเร็จ" : "ผลตรวจนับไม่ตรงตามมาตรฐาน",
              html: `ผลการตรวจนับ: <b>${escapeHtml(res.result || "-")}</b><br>ยอดมาตรฐาน: <b>${escapeHtml(res.actualTotal ?? 0)}</b> หน่วย<br>ยอดที่นับได้: <b>${escapeHtml(ampRemain + emptyAmp)}</b> หน่วย`
            }).then(() => {
              form.reset();
              if (countUserInput) countUserInput.value = "เจ้าหน้าที่เวร";
              if (remainHint) remainHint.innerText = "ยอดเป้าหมาย Stock Ward: -";
              window.initShiftCountPage();
            });
          } else {
            Swal.fire("บันทึกไม่สำเร็จ", res.message || "ไม่สามารถบันทึกข้อมูลตรวจนับได้", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
        }
      });
    }
  };

  window.renderDrugTable = function (drugList) {
    const tbody = document.getElementById("drug-tbody");
    if (!tbody) return;

    if (window.__drugDataTable && typeof window.__drugDataTable.destroy === "function") {
      window.__drugDataTable.destroy();
      window.__drugDataTable = null;
    }

    const rows = Array.isArray(drugList) ? drugList : [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">ยังไม่มีรายการยาในระบบ</td></tr>';
    } else {
      tbody.innerHTML = rows.map(item => `
        <tr>
          <td><span class="fw-semibold text-primary">${escapeHtml(item.DrugID || "-")}</span></td>
          <td class="fw-bold">${escapeHtml(item.DrugName || "-")}</td>
          <td>${escapeHtml(item.Strength || "-")}</td>
          <td><span class="badge bg-secondary">${escapeHtml(item.Unit || "-")}</span></td>
          <td class="text-center fw-bold" style="font-size:1.1rem; color:#10b981;">${escapeHtml(item.StockWard ?? 0)}</td>
          <td class="text-center">
            <button class="btn btn-warning btn-sm btn-edit-drug"
              data-id="${escapeHtml(item.DrugID || "")}"
              data-name="${escapeHtml(item.DrugName || "")}"
              data-strength="${escapeHtml(item.Strength || "")}"
              data-unit="${escapeHtml(item.Unit || "")}"
              data-stock="${escapeHtml(item.StockWard ?? 0)}">
              <i class="fas fa-edit me-1"></i>แก้ไข
            </button>
          </td>
        </tr>
      `).join("");
    }

    document.querySelectorAll(".btn-edit-drug").forEach(btn => {
      btn.addEventListener("click", function () {
        document.getElementById("drug-id-input").value = this.dataset.id || "";
        document.getElementById("drug-name-master").value = this.dataset.name || "";
        document.getElementById("drug-strength-master").value = this.dataset.strength || "";
        document.getElementById("drug-unit-master").value = this.dataset.unit || "";
        document.getElementById("stock-ward-master").value = this.dataset.stock || 0;
        document.getElementById("drugModalLabel").innerHTML = '<i class="fas fa-edit me-2"></i>แก้ไขข้อมูลยา';
        new bootstrap.Modal(document.getElementById("drugModal")).show();
      });
    });

    window.__drugDataTable = $("#drug-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "asc"]],
      pageLength: 10
    });
  };

  window.initSettingsPage = async function () {
    showLoading(true);
    try {
      const res = await GASApi.getDrugMaster();
      if (res.success) {
        window.renderDrugTable(res.data || []);
      } else {
        Swal.fire("เกิดข้อผิดพลาด", res.message || "ไม่สามารถดึงข้อมูลรายการยาได้", "error");
      }
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const form = document.getElementById("drug-form");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const stockWard = parseFloat(document.getElementById("stock-ward-master").value);
        if (Number.isNaN(stockWard) || stockWard < 0) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกจำนวน Stock Ward ให้ถูกต้อง", "warning");
          return;
        }

        showLoading(true);
        try {
          const res = await GASApi.updateDrugMaster({
            DrugID: document.getElementById("drug-id-input").value || "",
            DrugName: document.getElementById("drug-name-master").value.trim(),
            Strength: document.getElementById("drug-strength-master").value.trim(),
            Unit: document.getElementById("drug-unit-master").value.trim(),
            StockWard: stockWard
          });
          showLoading(false);
          if (res.success) {
            bootstrap.Modal.getInstance(document.getElementById("drugModal"))?.hide();
            form.reset();
            document.getElementById("drug-id-input").value = "";
            Swal.fire("บันทึกสำเร็จ", res.message || "บันทึกข้อมูลเรียบร้อยแล้ว", "success").then(() => {
              window.initSettingsPage();
            });
          } else {
            Swal.fire("บันทึกไม่สำเร็จ", res.message || "ไม่สามารถบันทึกข้อมูลยาได้", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
        }
      });
    }

    const addBtn = document.getElementById("btn-add-drug");
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = "1";
      addBtn.addEventListener("click", function () {
        document.getElementById("drug-id-input").value = "";
        document.getElementById("drugModalLabel").innerHTML = '<i class="fas fa-prescription-bottle-medical me-2"></i>เพิ่มข้อมูลยา';
        document.getElementById("drug-form").reset();
      });
    }
  };

  window.populateReportDrugDropdown = function (stockList) {
    const select = document.getElementById("report-drug-select");
    if (!select) return;

    const rows = Array.isArray(stockList) ? stockList : [];
    const unique = new Map();
    rows.forEach(item => {
      if (item.DrugID && !unique.has(item.DrugID)) {
        unique.set(item.DrugID, item.DrugName || "-");
      }
    });

    let html = '';
    unique.forEach((name, id) => {
      html += `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`;
    });
    select.innerHTML = html;
  };

  window.renderShiftReportPreview = function (data, yearMonth) {
    const contentDiv = document.getElementById("pdf-report-content");
    const titleEl = document.getElementById("pdf-report-title");
    const subtitleEl = document.getElementById("pdf-report-subtitle");

    if (!contentDiv || !titleEl || !subtitleEl) return;

    const [year, month] = String(yearMonth || "").split("-");
    const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const monthLabel = year && month ? `${months[parseInt(month, 10) - 1] || "-"} พ.ศ. ${parseInt(year, 10) + 543}` : "-";

    titleEl.innerText = "รายงานสรุปการตรวจนับประจำเวร";
    subtitleEl.innerText = `ประจำเดือน: ${monthLabel}`;

    if (!Array.isArray(data) || data.length === 0) {
      contentDiv.innerHTML = `<div class="text-center py-5 text-muted">ไม่พบข้อมูลการตรวจนับในเดือนที่เลือก</div>`;
      return;
    }

    const rowsHtml = data.map(item => {
      const isCorrect = item.Result === "ถูกต้อง";
      return `
        <tr>
          <td class="text-center">${escapeHtml(formatShortDate(item.Date))}</td>
          <td class="text-center"><span class="badge bg-primary">${escapeHtml(item.Shift || "-")}</span></td>
          <td>${escapeHtml(item.DrugName || "-")}</td>
          <td class="text-end">${escapeHtml(item.AmpRemain ?? 0)}</td>
          <td class="text-end">${escapeHtml(item.EmptyAmp ?? 0)}</td>
          <td class="text-end fw-semibold">${escapeHtml(item.ExpectedTotal ?? 0)}</td>
          <td class="text-center ${isCorrect ? "text-success" : "text-danger fw-bold"}">${escapeHtml(item.Result || "-")}</td>
          <td>${escapeHtml(item.User || "-")}</td>
        </tr>
      `;
    }).join("");

    contentDiv.innerHTML = `
      <table class="table table-bordered table-sm w-100">
        <thead style="background-color: #cbd5e1;">
          <tr class="text-center">
            <th>วันที่</th>
            <th>เวร</th>
            <th>ชื่อยา</th>
            <th>แอมป์ดี</th>
            <th>แอมป์เปล่า</th>
            <th>ยอดรวม</th>
            <th>ผลตรวจสอบ</th>
            <th>ผู้บันทึก</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  };

  window.renderDisburseReportPreview = function (data, drugName) {
    const contentDiv = document.getElementById("pdf-report-content");
    const titleEl = document.getElementById("pdf-report-title");
    const subtitleEl = document.getElementById("pdf-report-subtitle");

    if (!contentDiv || !titleEl || !subtitleEl) return;

    titleEl.innerText = "รายงานการตัดจ่ายยา";
    subtitleEl.innerText = `ชนิดยา: ${drugName || "-"}`;

    if (!Array.isArray(data) || data.length === 0) {
      contentDiv.innerHTML = `<div class="text-center py-5 text-muted">ไม่พบประวัติการตัดจ่ายสำหรับยาชนิดนี้</div>`;
      return;
    }

    const rowsHtml = data.map(item => `
      <tr>
        <td class="text-center">${escapeHtml(formatShortDate(item.Date))}</td>
        <td>${escapeHtml(item.DrugName || "-")}</td>
        <td class="text-center"><span class="badge bg-secondary">${escapeHtml(item.LOT || "-")}</span></td>
        <td>${escapeHtml(item.PatientName || "-")}</td>
        <td class="text-center">${escapeHtml(item.HN || "-")}</td>
        <td class="text-end fw-semibold">${escapeHtml(item.Qty ?? 0)}</td>
        <td>${escapeHtml(item.User || "-")}</td>
        <td class="text-center">${escapeHtml(formatDateTime(item.Timestamp))}</td>
      </tr>
    `).join("");

    contentDiv.innerHTML = `
      <table class="table table-bordered table-sm w-100">
        <thead style="background-color: #cbd5e1;">
          <tr class="text-center">
            <th>วันที่จ่าย</th>
            <th>ชื่อยา</th>
            <th>LOT</th>
            <th>ชื่อคนไข้</th>
            <th>HN</th>
            <th>จำนวนจ่าย</th>
            <th>ผู้จ่าย</th>
            <th>เวลาบันทึก</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  };

  window.initReportPage = async function () {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const printDateEl = document.getElementById("pdf-print-date");
    if (printDateEl) {
      printDateEl.innerText = "วันที่พิมพ์: " + new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
    }

    try {
      const stockRes = await GASApi.getDrugStock();
      if (stockRes.success) {
        window.populateReportDrugDropdown(stockRes.data || []);
      }
    } catch (err) {
      console.warn("Unable to load report dropdown:", err);
    }

    const shiftBtn = document.getElementById("btn-generate-shift-report");
    if (shiftBtn && !shiftBtn.dataset.bound) {
      shiftBtn.dataset.bound = "1";
      shiftBtn.addEventListener("click", async function () {
        const monthVal = document.getElementById("report-month-input").value;
        if (!monthVal) {
          Swal.fire("แจ้งเตือน", "กรุณาเลือกปีและเดือนสำหรับรายงานตรวจนับ", "warning");
          return;
        }
        showLoading(true);
        try {
          const res = await GASApi.getMonthlyShiftCountReport(monthVal);
          showLoading(false);
          if (res.success) {
            window.renderShiftReportPreview(res.data || [], monthVal);
            document.getElementById("btn-download-pdf").classList.remove("disabled");
            window.__reportMode = "shift";
          } else {
            Swal.fire("เกิดข้อผิดพลาด", res.message || "ไม่สามารถสร้างรายงานตรวจนับได้", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
        }
      });
    }

    const disburseBtn = document.getElementById("btn-generate-disburse-report");
    if (disburseBtn && !disburseBtn.dataset.bound) {
      disburseBtn.dataset.bound = "1";
      disburseBtn.addEventListener("click", async function () {
        const select = document.getElementById("report-drug-select");
        const selectedOptions = Array.from(select?.selectedOptions || []);
        const drugIDs = selectedOptions.map(opt => opt.value).filter(val => val !== "");
        const drugNames = selectedOptions.map(opt => opt.text).join(", ");
        
        if (drugIDs.length === 0) {
          Swal.fire("แจ้งเตือน", "กรุณาเลือกชนิดยาสำหรับรายงานการตัดจ่ายอย่างน้อย 1 รายการ", "warning");
          return;
        }
        showLoading(true);
        try {
          // Send empty string to fetch all data, then filter on the client side
          const res = await GASApi.getDisbursementReport("");
          showLoading(false);
          if (res.success) {
            const allData = Array.isArray(res.data) ? res.data : [];
            const filteredData = allData.filter(item => drugIDs.includes(item.DrugID));
            window.renderDisburseReportPreview(filteredData, drugNames);
            document.getElementById("btn-download-pdf").classList.remove("disabled");
            window.__reportMode = "disburse";
          } else {
            Swal.fire("เกิดข้อผิดพลาด", res.message || "ไม่สามารถสร้างรายงานตัดจ่ายได้", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
        }
      });
    }

    const downloadBtn = document.getElementById("btn-download-pdf");
    if (downloadBtn && !downloadBtn.dataset.bound) {
      downloadBtn.dataset.bound = "1";
      downloadBtn.addEventListener("click", function () {
        if (this.classList.contains("disabled")) return;
        const printArea = document.getElementById("report-print-area");
        if (!printArea) return;

        showLoading(true);
        setTimeout(async () => {
          try {
            const { jsPDF } = window.jspdf;
            const canvas = await html2canvas(printArea, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              logging: false
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            while (heightLeft >= 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
            }

            const mode = window.__reportMode || "report";
            pdf.save(`report-${mode}-${new Date().toISOString().slice(0, 10)}.pdf`);
            showLoading(false);
            showToast("ดาวน์โหลด PDF สำเร็จ");
          } catch (err) {
            showLoading(false);
            Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
          }
        }, 300);
      });
    }
  };
})();
