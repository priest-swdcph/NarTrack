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

  function readJsonCache(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJsonCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
    } catch (err) {}
  }

  function getDrugMasterCache() {
    return readJsonCache("drug_master_cache", []);
  }

  function setDrugMasterCache(list) {
    writeJsonCache("drug_master_cache", list);
    window.__drugMasterCache = Array.isArray(list) ? list : [];
  }

  function getShiftCountHistoryCache() {
    return readJsonCache("shift_count_history_cache", []);
  }

  function setShiftCountHistoryCache(list) {
    writeJsonCache("shift_count_history_cache", list);
    window.__shiftCountHistoryCache = Array.isArray(list) ? list : [];
  }

  function setInlineLoadingState(targetId, show, message) {
    if (targetId === "shift-batch-loading") {
      window.__shiftCountLoadingState = !!show;
    }
    const box = document.getElementById(targetId);
    if (!box) return;
    const text = box.querySelector("[data-loading-text]");
    if (message && text) text.textContent = message;
    box.classList.toggle("d-none", !show);
  }

  function renderEmptyRow(tbody, colSpan, message) {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted py-4">${escapeHtml(message)}</td></tr>`;
  }

  function populateDisbursementDropdown(stockList) {
    const select = document.getElementById("disburse-stock-select");
    if (!select) return;

    const currentValue = select.value;
    const rows = Array.isArray(stockList) ? stockList.filter(item => parseFloat(item.QtyRemain || 0) > 0) : [];

    let html = '<option value="" disabled selected>-- เน€เธฅเธทเธญเธเธขเธฒเนเธฅเธฐเธฅเนเธญเธ•เธเธฒเธเธเธฅเธฑเธ --</option>';
    if (rows.length === 0) {
      html = '<option value="" disabled selected>-- เนเธกเนเธเธเธฃเธฒเธขเธเธฒเธฃเธเธเน€เธซเธฅเธทเธญ --</option>';
    } else {
      rows.forEach(item => {
        const text = `${item.DrugName || "-"} | LOT ${item.LOT || "-"} | เธเธเน€เธซเธฅเธทเธญ ${item.QtyRemain ?? 0}`;
        html += `<option value="${escapeHtml(item.StockID)}">${escapeHtml(text)}</option>`;
      });
    }

    select.innerHTML = html;
    if (currentValue) {
      select.value = currentValue;
    }
  }

  function populateReceiveDrugDropdown(masterList) {
    const select = document.getElementById("drug-name-input");
    if (!select) return;

    const rows = Array.isArray(masterList) ? masterList : [];
    setDrugMasterCache(rows);
    if (rows.length === 0) {
      select.innerHTML = '<option value="" selected disabled>เนเธกเนเธเธเธฃเธฒเธขเธเธฒเธฃเธขเธฒเนเธ Drug Master</option>';
      return;
    }

    let html = '<option value="" selected disabled>-- เน€เธฅเธทเธญเธเธเธทเนเธญเธขเธฒ --</option>';
    rows.forEach(item => {
      const label = `${item.DrugName || "-"}${item.Strength ? ` (${item.Strength})` : ""}${item.Unit ? ` - ${item.Unit}` : ""}`;
      html += `<option value="${escapeHtml(item.DrugID || "")}" data-name="${escapeHtml(item.DrugName || "")}" data-strength="${escapeHtml(item.Strength || "")}" data-unit="${escapeHtml(item.Unit || "")}">${escapeHtml(label)}</option>`;
    });

    select.innerHTML = html;
  }

  function syncReceiveDrugFieldsFromSelect() {
    const select = document.getElementById("drug-name-input");
    const strengthInput = document.getElementById("drug-strength-input");
    const unitInput = document.getElementById("drug-unit-input");
    if (!select) return;

    const option = select.selectedOptions && select.selectedOptions[0];
    if (strengthInput) strengthInput.value = "";
    if (unitInput) unitInput.value = "";
    if (!option || !option.dataset) {
      return;
    }
    if (strengthInput && option.dataset.strength) {
      strengthInput.value = option.dataset.strength;
    }
    if (unitInput && option.dataset.unit) {
      unitInput.value = option.dataset.unit;
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
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">เธขเธฑเธเนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธ•เธฑเธ”เธเนเธฒเธขเธขเธฒ</td></tr>';
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
              <span class="d-block">เธฃเธฐเธเธเธ•เธฃเธงเธเธเธฑเธเนเธฅเธฐเธ•เธฑเธ”เธเนเธฒเธขเธขเธฒเน€เธชเธเธ•เธดเธ”</span>
              <small class="fw-normal opacity-75">เธซเธญเธชเธเธเนเธญเธฒเธเธฒเธ เนเธฃเธเธเธขเธฒเธเธฒเธฅเธชเธกเน€เธ”เนเธเธเธฃเธฐเธขเธธเธเธฃเธฒเธเธชเธงเนเธฒเธเนเธ”เธเธ”เธดเธ</small>
            </span>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0 nav-scroll-x">
              <li class="nav-item"><a class="nav-link" id="nav-dashboard" href="dashboard.html"><i class="fas fa-chart-line me-1"></i> เนเธ”เธเธเธญเธฃเนเธ”</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-stock" href="stock.html"><i class="fas fa-boxes-stacked me-1"></i> เธฃเธฑเธเน€เธเนเธฒ</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-disbursement" href="disbursement.html"><i class="fas fa-file-medical me-1"></i> เธ•เธฑเธ”เธเนเธฒเธข</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-shiftcount" href="shiftcount.html"><i class="fas fa-clipboard-check me-1"></i> เธ•เธฃเธงเธเธเธฑเธ</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-report" href="report.html"><i class="fas fa-file-pdf me-1"></i> เธฃเธฒเธขเธเธฒเธ</a></li>
              <li class="nav-item"><a class="nav-link" id="nav-settings" href="settings.html"><i class="fas fa-sliders me-1"></i> เธ•เธฑเนเธเธเนเธฒเธฃเธฒเธขเธเธฒเธฃ</a></li>
            </ul>
            <div class="d-flex align-items-center">
              <button class="btn btn-outline-light btn-sm" id="btn-config-api">
                <i class="fas fa-cog me-1"></i> เธ•เธฑเนเธเธเนเธฒ API
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
          title: 'เธ•เธฑเนเธเธเนเธฒเธเธฒเธฃเน€เธเธทเนเธญเธกเธ•เนเธญ API',
          text: 'เธเธฃเธญเธ Google Apps Script Web App API URL เธชเธณเธซเธฃเธฑเธเธฃเธฐเธเธ',
          input: 'text',
          inputValue: GASApi.getApiUrl(),
          inputPlaceholder: 'https://script.google.com/macros/s/.../exec',
          showCancelButton: true,
          confirmButtonText: 'เธเธฑเธเธ—เธถเธ',
          cancelButtonText: 'เธขเธเน€เธฅเธดเธ'
        });
        if (url) {
          GASApi.setApiUrl(url);
          showToast("เธเธฑเธเธ—เธถเธ API URL เน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง");
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
      Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const stockSelect = document.getElementById("disburse-stock-select");
    const remainHint = document.getElementById("stock-remain-hint");
    const disburseUserInput = document.getElementById("disburse-user-input");
    if (disburseUserInput) {
      disburseUserInput.value = disburseUserInput.value || "เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเน€เธงเธฃ";
    }
    if (stockSelect && remainHint && !stockSelect.dataset.bound) {
      stockSelect.dataset.bound = "1";
      stockSelect.addEventListener("change", function () {
        const selected = (window.__disbursementStockCache || []).find(item => item.StockID === this.value);
        if (selected) {
          remainHint.innerText = `เธเธเน€เธซเธฅเธทเธญเนเธเธฃเธฐเธเธ: ${selected.QtyRemain} ${selected.Unit || "เธซเธเนเธงเธข"}`;
        } else {
          remainHint.innerText = "เธเธเน€เธซเธฅเธทเธญเนเธเธฃเธฐเธเธ: -";
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
        const patientName = (document.getElementById("patient-name-input")?.value || "").trim();
        const hn = (document.getElementById("patient-hn-input")?.value || "").trim();
        const user = (document.getElementById("disburse-user-input")?.value || "").trim();

        if (!stockID) {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธฃเธฒเธขเธเธฒเธฃเธขเธฒเนเธฅเธฐเธฅเนเธญเธ•เธเนเธญเธเธ•เธฑเธ”เธเนเธฒเธข", "warning");
          return;
        }
        if (!patientName || !hn || !user) {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธเธนเนเธเนเธงเธขเนเธฅเธฐเธเธนเนเธเนเธฒเธขเธขเธฒเนเธซเนเธเธฃเธเธ–เนเธงเธ", "warning");
          return;
        }
        if (!qty || qty <= 0) {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธณเธเธงเธเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃเธเนเธฒเธขเนเธซเนเธ–เธนเธเธ•เนเธญเธ", "warning");
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
            const drugName = response.drugName || "เธฃเธฒเธขเธเธฒเธฃเธ—เธตเนเน€เธฅเธทเธญเธ";
            const qtyRemain = response.qtyRemain ?? "-";
            Swal.fire({
              icon: "success",
              title: "เธ•เธฑเธ”เธเนเธฒเธขเธชเธณเน€เธฃเนเธ",
              html: `เธ•เธฑเธ”เธเนเธฒเธข <b>${escapeHtml(drugName)}</b> เธเธณเธเธงเธ <b>${escapeHtml(qty)}</b> เธซเธเนเธงเธข<br>เธเธเน€เธซเธฅเธทเธญเนเธเธฃเธฐเธเธ: <b>${escapeHtml(qtyRemain)}</b> เธซเธเนเธงเธข`
            }).then(() => {
              disburseForm.reset();
              if (disburseUserInput) disburseUserInput.value = "เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเน€เธงเธฃ";
              if (remainHint) remainHint.innerText = "เธเธเน€เธซเธฅเธทเธญเนเธเธฃเธฐเธเธ: -";
              window.initDisbursementPage();
            });
          } else {
        window.renderStockTable([]);
          }
        } catch (error) {
          showLoading(false);
          Swal.fire("เน€เธเธทเนเธญเธกเธ•เนเธญเธฅเนเธกเน€เธซเธฅเธง", error.toString(), "error");
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
    const masterRows = Array.isArray(window.__drugMasterCache) && window.__drugMasterCache.length ? window.__drugMasterCache : getDrugMasterCache();
    const masterMap = new Map(masterRows.map(item => [String(item.DrugID || ""), item]));

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเธฃเธฑเธเน€เธเนเธฒเธขเธฒ</td></tr>';
    } else {
      tbody.innerHTML = rows.map(item => {
        const remain = parseFloat(item.QtyRemain || 0);
        const expiryDate = item.ExpiryDate ? new Date(item.ExpiryDate) : null;
        let statusBadge = '<span class="badge bg-secondary">เธเธเธ•เธด</span>';

        if (remain <= 0) {
          statusBadge = '<span class="badge bg-secondary">เธซเธกเธ”เนเธฅเนเธง</span>';
        } else if (expiryDate && !Number.isNaN(expiryDate.getTime())) {
          const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            statusBadge = '<span class="expiry-status-danger">เธซเธกเธ”เธญเธฒเธขเธธ</span>';
          } else if (diffDays <= 30) {
            statusBadge = '<span class="expiry-status-warning">เนเธเธฅเนเธซเธกเธ”เธญเธฒเธขเธธ</span>';
          } else {
            statusBadge = '<span class="expiry-status-safe">เธเธเธ•เธด</span>';
          }
        }

        const fmtReceive = formatShortDate(item.ReceiveDate);
        const fmtExpiry = formatShortDate(item.ExpiryDate);
        const displayDrugName = masterMap.get(String(item.DrugID || ""))?.DrugName || item.DrugName || "-";

        return `
          <tr>
            <td><span class="fw-semibold text-primary">${escapeHtml(item.StockID || "-")}</span></td>
            <td>${escapeHtml(displayDrugName)}</td>
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
      const [stockResult, masterResult] = await Promise.allSettled([
        GASApi.getDrugStock(),
        GASApi.getDrugMaster()
      ]);
      const stockResponse = stockResult.status === "fulfilled" ? stockResult.value : null;
      const masterResponse = masterResult.status === "fulfilled" ? masterResult.value : null;
      const masterRows = masterResponse && masterResponse.success ? (masterResponse.data || []) : getDrugMasterCache();
      if (masterResponse && masterResponse.success) {
        setDrugMasterCache(masterRows);
      }
      populateReceiveDrugDropdown(masterRows);
      if (stockResponse && stockResponse.success) {
        window.renderStockTable(stockResponse.data || []);
      } else {
        window.renderStockTable([]);
      }
    } catch (err) {
      Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const receiveDateInput = document.getElementById("receive-date-input");
    const createdByInput = document.getElementById("created-by-input");
    if (receiveDateInput) {
      receiveDateInput.value = new Date().toISOString().slice(0, 10);
    }
    if (createdByInput) {
      createdByInput.value = createdByInput.value || "เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเน€เธงเธฃ";
    }
    const drugNameSelect = document.getElementById("drug-name-input");
    if (drugNameSelect && !drugNameSelect.dataset.bound) {
      drugNameSelect.dataset.bound = "1";
      drugNameSelect.addEventListener("change", syncReceiveDrugFieldsFromSelect);
    }
    syncReceiveDrugFieldsFromSelect();

    const addStockForm = document.getElementById("add-stock-form");
    if (addStockForm && !addStockForm.dataset.bound) {
      addStockForm.dataset.bound = "1";
      addStockForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const qty = parseFloat(document.getElementById('qty-receive-input').value);
        const drugSelect = document.getElementById('drug-name-input');
        const selectedOption = drugSelect?.selectedOptions?.[0];
        if (!qty || qty <= 0) {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธณเธเธงเธเธฃเธฑเธเน€เธเนเธฒเธ—เธตเนเธ–เธนเธเธ•เนเธญเธ", "warning");
          return;
        }

        const payload = {
          DrugID: drugSelect?.value || '',
          DrugName: selectedOption.dataset.name || '',
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
            if (createdByInput) createdByInput.value = "เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเน€เธงเธฃ";
            Swal.fire("เธเธฑเธเธ—เธถเธเธชเธณเน€เธฃเนเธ", res.message || "เธเธฑเธเธ—เธถเธเธเนเธญเธกเธนเธฅเธฃเธฑเธเน€เธเนเธฒเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง", "success").then(() => {
              window.initStockPage();
            });
          } else {
            Swal.fire("เธเธฑเธเธ—เธถเธเนเธกเนเธชเธณเน€เธฃเนเธ", res.message || "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธเธฑเธเธ—เธถเธเธเนเธญเธกเธนเธฅเธฃเธฑเธเน€เธเนเธฒเนเธ”เน", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เน€เธเธทเนเธญเธกเธ•เนเธญเธฅเนเธกเน€เธซเธฅเธง", err.toString(), "error");
        }
      });
    }
  };

  window.populateShiftCountDrugs = function (masterList) {
    const select = document.getElementById("count-drug-select");
    if (!select) return;

    const rows = Array.isArray(masterList) ? masterList : [];
    let html = '<option value="" disabled selected>-- เน€เธฅเธทเธญเธเธขเธฒ --</option>';
    rows.forEach(item => {
      const label = `${item.DrugName || "-"}${item.Strength ? ` (${item.Strength})` : ""}`;
      html += `<option value="${escapeHtml(item.DrugID)}">${escapeHtml(label)}</option>`;
    });
    select.innerHTML = html;
  };

  window.renderShiftCountTable = function (historyList) {
    const tbody = document.getElementById("shift-history-tbody");
    if (!tbody) return;

    if (window.__shiftCountTable && typeof window.__shiftCountTable.destroy === "function") {
      window.__shiftCountTable.destroy();
      window.__shiftCountTable = null;
    }

    const rows = Array.isArray(historyList) ? historyList : [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">เธขเธฑเธเนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเธ•เธฃเธงเธเธเธฑเธ</td></tr>';
    } else {
      tbody.innerHTML = rows.map(item => {
        const isCorrect = item.Result === "เธ–เธนเธเธ•เนเธญเธ";
        const resultBadge = isCorrect
          ? '<span class="badge bg-success-subtle text-success px-2 py-1"><i class="fas fa-check me-1"></i>เธ–เธนเธเธ•เนเธญเธ</span>'
          : '<span class="badge bg-danger-subtle text-danger px-2 py-1"><i class="fas fa-circle-exclamation me-1"></i>เนเธกเนเธ•เธฃเธ</span>';
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

    window.__shiftCountTable = $("#shift-history-table").DataTable({
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
      Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const drugSelect = document.getElementById("count-drug-select");
    const remainHint = document.getElementById("shift-remain-hint");
    const countUserInput = document.getElementById("count-user-input");
    if (countUserInput) {
      countUserInput.value = countUserInput.value || "เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเน€เธงเธฃ";
    }
    if (drugSelect && remainHint && !drugSelect.dataset.bound) {
      drugSelect.dataset.bound = "1";
      drugSelect.addEventListener("change", function () {
        const selected = (window.__masterCache || []).find(item => item.DrugID === this.value);
        remainHint.innerText = selected
          ? `เธขเธญเธ”เน€เธเนเธฒเธซเธกเธฒเธข Stock Ward: ${selected.StockWard || 0} ${selected.Unit || "เธซเธเนเธงเธข"}`
          : "เธขเธญเธ”เน€เธเนเธฒเธซเธกเธฒเธข Stock Ward: -";
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
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธขเธญเธ”เธเธฑเธเธซเนเธฒเธกเน€เธเนเธเธเนเธฒเธ•เธดเธ”เธฅเธ", "warning");
          return;
        }
        if (!drugSelect?.value) {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธทเนเธญเธขเธฒเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃเธ•เธฃเธงเธเธเธฑเธ", "warning");
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
            const isCorrect = res.result === "เธ–เธนเธเธ•เนเธญเธ";
            Swal.fire({
              icon: isCorrect ? "success" : "warning",
              title: isCorrect ? "เธเธฑเธเธ—เธถเธเธเธฒเธฃเธ•เธฃเธงเธเธเธฑเธเธชเธณเน€เธฃเนเธ" : "เธเธฅเธ•เธฃเธงเธเธเธฑเธเนเธกเนเธ•เธฃเธเธ•เธฒเธกเธกเธฒเธ•เธฃเธเธฒเธ",
              html: `เธเธฅเธเธฒเธฃเธ•เธฃเธงเธเธเธฑเธ: <b>${escapeHtml(res.result || "-")}</b><br>เธขเธญเธ”เธกเธฒเธ•เธฃเธเธฒเธ: <b>${escapeHtml(res.actualTotal ?? 0)}</b> เธซเธเนเธงเธข<br>เธขเธญเธ”เธ—เธตเนเธเธฑเธเนเธ”เน: <b>${escapeHtml(ampRemain + emptyAmp)}</b> เธซเธเนเธงเธข`
            }).then(() => {
              form.reset();
              if (countUserInput) countUserInput.value = "เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเน€เธงเธฃ";
              if (remainHint) remainHint.innerText = "เธขเธญเธ”เน€เธเนเธฒเธซเธกเธฒเธข Stock Ward: -";
              window.initShiftCountPage();
            });
          } else {
            Swal.fire("เธเธฑเธเธ—เธถเธเนเธกเนเธชเธณเน€เธฃเนเธ", res.message || "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธเธฑเธเธ—เธถเธเธเนเธญเธกเธนเธฅเธ•เธฃเธงเธเธเธฑเธเนเธ”เน", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เน€เธเธทเนเธญเธกเธ•เนเธญเธฅเนเธกเน€เธซเธฅเธง", err.toString(), "error");
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
    setDrugMasterCache(rows);
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">เธขเธฑเธเนเธกเนเธกเธตเธฃเธฒเธขเธเธฒเธฃเธขเธฒเนเธเธฃเธฐเธเธ</td></tr>';
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
              <i class="fas fa-edit me-1"></i>เนเธเนเนเธ
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
        document.getElementById("drugModalLabel").innerHTML = '<i class="fas fa-edit me-2"></i>เนเธเนเนเธเธเนเธญเธกเธนเธฅเธขเธฒ';
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
        Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", res.message || "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธ”เธถเธเธเนเธญเธกเธนเธฅเธฃเธฒเธขเธเธฒเธฃเธขเธฒเนเธ”เน", "error");
      }
    } catch (err) {
      Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", err.toString(), "error");
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
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธณเธเธงเธ Stock Ward เนเธซเนเธ–เธนเธเธ•เนเธญเธ", "warning");
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
            Swal.fire("เธเธฑเธเธ—เธถเธเธชเธณเน€เธฃเนเธ", res.message || "เธเธฑเธเธ—เธถเธเธเนเธญเธกเธนเธฅเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง", "success").then(() => {
              window.initSettingsPage();
            });
          } else {
            Swal.fire("เธเธฑเธเธ—เธถเธเนเธกเนเธชเธณเน€เธฃเนเธ", res.message || "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธเธฑเธเธ—เธถเธเธเนเธญเธกเธนเธฅเธขเธฒเนเธ”เน", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เน€เธเธทเนเธญเธกเธ•เนเธญเธฅเนเธกเน€เธซเธฅเธง", err.toString(), "error");
        }
      });
    }

    const addBtn = document.getElementById("btn-add-drug");
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = "1";
      addBtn.addEventListener("click", function () {
        document.getElementById("drug-id-input").value = "";
        document.getElementById("drugModalLabel").innerHTML = '<i class="fas fa-prescription-bottle-medical me-2"></i>เน€เธเธดเนเธกเธเนเธญเธกเธนเธฅเธขเธฒ';
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
    const months = ["เธกเธเธฃเธฒเธเธก", "เธเธธเธกเธ เธฒเธเธฑเธเธเน", "เธกเธตเธเธฒเธเธก", "เน€เธกเธฉเธฒเธขเธ", "เธเธคเธฉเธ เธฒเธเธก", "เธกเธดเธ–เธธเธเธฒเธขเธ", "เธเธฃเธเธเธฒเธเธก", "เธชเธดเธเธซเธฒเธเธก", "เธเธฑเธเธขเธฒเธขเธ", "เธ•เธธเธฅเธฒเธเธก", "เธเธคเธจเธเธดเธเธฒเธขเธ", "เธเธฑเธเธงเธฒเธเธก"];
    const monthLabel = year && month ? `${months[parseInt(month, 10) - 1] || "-"} เธ.เธจ. ${parseInt(year, 10) + 543}` : "-";

    titleEl.innerText = "เธฃเธฒเธขเธเธฒเธเธชเธฃเธธเธเธเธฒเธฃเธ•เธฃเธงเธเธเธฑเธเธเธฃเธฐเธเธณเน€เธงเธฃ";
    subtitleEl.innerText = `เธเธฃเธฐเธเธณเน€เธ”เธทเธญเธ: ${monthLabel}`;

    if (!Array.isArray(data) || data.length === 0) {
      contentDiv.innerHTML = `<div class="text-center py-5 text-muted">เนเธกเนเธเธเธเนเธญเธกเธนเธฅเธเธฒเธฃเธ•เธฃเธงเธเธเธฑเธเนเธเน€เธ”เธทเธญเธเธ—เธตเนเน€เธฅเธทเธญเธ</div>`;
      return;
    }

    const rowsHtml = data.map(item => {
      const isCorrect = item.Result === "เธ–เธนเธเธ•เนเธญเธ";
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
            <th>เธงเธฑเธเธ—เธตเน</th>
            <th>เน€เธงเธฃ</th>
            <th>เธเธทเนเธญเธขเธฒ</th>
            <th>เนเธญเธกเธเนเธ”เธต</th>
            <th>เนเธญเธกเธเนเน€เธเธฅเนเธฒ</th>
            <th>เธขเธญเธ”เธฃเธงเธก</th>
            <th>เธเธฅเธ•เธฃเธงเธเธชเธญเธ</th>
            <th>เธเธนเนเธเธฑเธเธ—เธถเธ</th>
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

    titleEl.innerText = "เธฃเธฒเธขเธเธฒเธเธเธฒเธฃเธ•เธฑเธ”เธเนเธฒเธขเธขเธฒ";
    subtitleEl.innerText = `เธเธเธดเธ”เธขเธฒ: ${drugName || "-"}`;

    if (!Array.isArray(data) || data.length === 0) {
      contentDiv.innerHTML = `<div class="text-center py-5 text-muted">เนเธกเนเธเธเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธ•เธฑเธ”เธเนเธฒเธขเธชเธณเธซเธฃเธฑเธเธขเธฒเธเธเธดเธ”เธเธตเน</div>`;
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
            <th>เธงเธฑเธเธ—เธตเนเธเนเธฒเธข</th>
            <th>เธเธทเนเธญเธขเธฒ</th>
            <th>LOT</th>
            <th>เธเธทเนเธญเธเธเนเธเน</th>
            <th>HN</th>
            <th>เธเธณเธเธงเธเธเนเธฒเธข</th>
            <th>เธเธนเนเธเนเธฒเธข</th>
            <th>เน€เธงเธฅเธฒเธเธฑเธเธ—เธถเธ</th>
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
      printDateEl.innerText = "เธงเธฑเธเธ—เธตเนเธเธดเธกเธเน: " + new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
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
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธตเนเธฅเธฐเน€เธ”เธทเธญเธเธชเธณเธซเธฃเธฑเธเธฃเธฒเธขเธเธฒเธเธ•เธฃเธงเธเธเธฑเธ", "warning");
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
            Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", res.message || "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธชเธฃเนเธฒเธเธฃเธฒเธขเธเธฒเธเธ•เธฃเธงเธเธเธฑเธเนเธ”เน", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เน€เธเธทเนเธญเธกเธ•เนเธญเธฅเนเธกเน€เธซเธฅเธง", err.toString(), "error");
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
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธเธดเธ”เธขเธฒเธชเธณเธซเธฃเธฑเธเธฃเธฒเธขเธเธฒเธเธเธฒเธฃเธ•เธฑเธ”เธเนเธฒเธขเธญเธขเนเธฒเธเธเนเธญเธข 1 เธฃเธฒเธขเธเธฒเธฃ", "warning");
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
            Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", res.message || "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธชเธฃเนเธฒเธเธฃเธฒเธขเธเธฒเธเธ•เธฑเธ”เธเนเธฒเธขเนเธ”เน", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เน€เธเธทเนเธญเธกเธ•เนเธญเธฅเนเธกเน€เธซเธฅเธง", err.toString(), "error");
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
            showToast("เธ”เธฒเธงเธเนเนเธซเธฅเธ” PDF เธชเธณเน€เธฃเนเธ");
          } catch (err) {
            showLoading(false);
            Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", err.toString(), "error");
          }
        }, 300);
      });
    }
  };
  function getBangkokDateString(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date || new Date());
  }

  function formatThaiDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH-u-ca-buddhist", {
      timeZone: "Asia/Bangkok",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function formatThaiDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH-u-ca-buddhist", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "long",
      year: "numeric"
    }) + " " + date.toLocaleTimeString("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getSelectedShiftValue() {
    const checked = document.querySelector('input[name="shift-select"]:checked');
    return checked ? checked.value : "เน€เธเนเธฒ";
  }

  function getShiftLabel(shift) {
    const labels = {
      "เน€เธเนเธฒ": "เน€เธงเธฃเน€เธเนเธฒ",
      "เธเนเธฒเธข": "เน€เธงเธฃเธเนเธฒเธข",
      "เธ”เธถเธ": "เน€เธงเธฃเธ”เธถเธ"
    };
    return labels[shift] || shift || "-";
  }

  function getCurrentUserName() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user && user.name) return user.name;
    } catch (err) {}
    return "เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเน€เธงเธฃ";
  }

  function isValidNumber(value) {
    return value !== "" && !Number.isNaN(Number(value)) && Number(value) >= 0;
  }

  function emptyTableRowHtml(colCount, message) {
    const cells = [`<td class="text-center text-muted py-4">${escapeHtml(message)}</td>`];
    for (let i = 1; i < colCount; i++) {
      cells.push("<td></td>");
    }
    return `<tr>${cells.join("")}</tr>`;
  }

  function destroyTableInstance(instanceName) {
    if (window[instanceName] && typeof window[instanceName].destroy === "function") {
      window[instanceName].destroy();
      window[instanceName] = null;
    }
  }

  window.renderDisbursementTable = function (rows) {
    const tbody = document.getElementById("disbursement-tbody");
    if (!tbody) return;

    destroyTableInstance("__disbursementTable");
    tbody.closest("table")?.classList.add("stack-table-mobile");
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
      tbody.innerHTML = emptyTableRowHtml(7, "เธขเธฑเธเนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธ•เธฑเธ”เธเนเธฒเธขเธขเธฒ");
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr>
        <td data-label="เธฃเธซเธฑเธชเธฃเธฒเธขเธเธฒเธฃ"><span class="fw-semibold text-primary">${escapeHtml(item.DisburseID || item.DrugName || "-")}</span></td>
        <td data-label="เธเธทเนเธญเธขเธฒ" class="fw-semibold">${escapeHtml(item.DrugName || "-")}</td>
        <td data-label="LOT"><span class="badge bg-secondary">${escapeHtml(item.LOT || "-")}</span></td>
        <td data-label="เธเธทเนเธญเธเธนเนเธเนเธงเธข">${escapeHtml(item.PatientName || "-")} <span class="text-muted">(${escapeHtml(item.HN || "-")})</span></td>
        <td data-label="เธเธณเธเธงเธ" class="text-end fw-bold">${escapeHtml(item.Qty ?? 0)}</td>
        <td data-label="เธเธนเนเธเธฑเธเธ—เธถเธ">${escapeHtml(item.User || "-")}</td>
        <td data-label="เน€เธงเธฅเธฒ">${formatThaiDateTime(item.Timestamp || item.Date)}</td>
      </tr>
    `).join("");

    window.__disbursementTable = $("#disbursement-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 10,
      responsive: true
    });
  };

  window.renderStockTable = function (stockList) {
    const tbody = document.getElementById("stock-tbody");
    if (!tbody) return;

    destroyTableInstance("__stockDataTable");
    tbody.closest("table")?.classList.add("stack-table-mobile");
    const rows = Array.isArray(stockList) ? stockList : [];
    const today = new Date();
    if (rows.length === 0) {
      tbody.innerHTML = emptyTableRowHtml(9, "เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเธฃเธฑเธเน€เธเนเธฒเธขเธฒ");
      return;
    }

    tbody.innerHTML = rows.map(item => {
      const remain = parseFloat(item.QtyRemain || 0);
      const expiryDate = item.ExpiryDate ? new Date(item.ExpiryDate) : null;
      let statusBadge = '<span class="badge bg-secondary">เธเธเธ•เธด</span>';

      if (remain <= 0) {
        statusBadge = '<span class="badge bg-secondary">เธซเธกเธ”เนเธฅเนเธง</span>';
      } else if (expiryDate && !Number.isNaN(expiryDate.getTime())) {
        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          statusBadge = '<span class="expiry-status-danger">เธซเธกเธ”เธญเธฒเธขเธธ</span>';
        } else if (diffDays <= 30) {
          statusBadge = '<span class="expiry-status-warning">เนเธเธฅเนเธซเธกเธ”เธญเธฒเธขเธธ</span>';
        } else {
          statusBadge = '<span class="expiry-status-safe">เธเธเธ•เธด</span>';
        }
      }

      return `
        <tr>
          <td data-label="เธฃเธซเธฑเธชเธชเธ•เนเธญเธ"><span class="fw-semibold text-primary">${escapeHtml(item.StockID || "-")}</span></td>
          <td data-label="เธเธทเนเธญเธขเธฒ">${escapeHtml(item.DrugName || "-")}</td>
          <td data-label="LOT"><span class="badge bg-secondary">${escapeHtml(item.LOT || "-")}</span></td>
          <td data-label="เธงเธฑเธเธซเธกเธ”เธญเธฒเธขเธธ">${escapeHtml(formatThaiDate(item.ExpiryDate))}</td>
          <td data-label="เธฃเธฑเธเน€เธเนเธฒ">${escapeHtml(item.QtyReceive ?? 0)}</td>
          <td data-label="เธเธเน€เธซเธฅเธทเธญ" class="fw-bold">${escapeHtml(item.QtyRemain ?? 0)}</td>
          <td data-label="เธงเธฑเธเธ—เธตเนเธฃเธฑเธเน€เธเนเธฒ">${escapeHtml(formatThaiDate(item.ReceiveDate))}</td>
          <td data-label="เธเธนเนเธเธฑเธเธ—เธถเธ">${escapeHtml(item.CreatedBy || "-")}</td>
          <td data-label="เธชเธ–เธฒเธเธฐ">${statusBadge}</td>
        </tr>
      `;
    }).join("");

    window.__stockDataTable = $("#stock-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 10
    });
  };

  window.renderDrugTable = function (drugList) {
    const tbody = document.getElementById("drug-tbody");
    if (!tbody) return;

    destroyTableInstance("__drugDataTable");
    tbody.closest("table")?.classList.add("stack-table-mobile");
    const rows = Array.isArray(drugList) ? drugList : [];
    if (rows.length === 0) {
      tbody.innerHTML = emptyTableRowHtml(6, "เธขเธฑเธเนเธกเนเธกเธตเธฃเธฒเธขเธเธฒเธฃเธขเธฒเนเธเธฃเธฐเธเธ");
      return;
    }

    tbody.innerHTML = rows.map(item => `
      <tr>
        <td data-label="เธฃเธซเธฑเธชเธขเธฒ"><span class="fw-semibold text-primary">${escapeHtml(item.DrugID || "-")}</span></td>
        <td data-label="เธเธทเนเธญเธขเธฒ" class="fw-bold">${escapeHtml(item.DrugName || "-")}</td>
        <td data-label="เธเธงเธฒเธกเนเธฃเธ">${escapeHtml(item.Strength || "-")}</td>
        <td data-label="เธซเธเนเธงเธข"><span class="badge bg-secondary">${escapeHtml(item.Unit || "-")}</span></td>
        <td data-label="Stock Ward" class="text-center fw-bold" style="font-size:1.05rem; color:#10b981;">${escapeHtml(item.StockWard ?? 0)}</td>
        <td data-label="เธเธฑเธ”เธเธฒเธฃ" class="text-center">
          <button class="btn btn-warning btn-sm btn-edit-drug"
            data-id="${escapeHtml(item.DrugID || "")}"
            data-name="${escapeHtml(item.DrugName || "")}"
            data-strength="${escapeHtml(item.Strength || "")}"
            data-unit="${escapeHtml(item.Unit || "")}"
            data-stock="${escapeHtml(item.StockWard ?? 0)}">
            <i class="fas fa-edit me-1"></i>เนเธเนเนเธ
          </button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btn-edit-drug").forEach(btn => {
      btn.addEventListener("click", function () {
        document.getElementById("drug-id-input").value = this.dataset.id || "";
        document.getElementById("drug-name-master").value = this.dataset.name || "";
        document.getElementById("drug-strength-master").value = this.dataset.strength || "";
        document.getElementById("drug-unit-master").value = this.dataset.unit || "";
        document.getElementById("stock-ward-master").value = this.dataset.stock || 0;
        document.getElementById("drugModalLabel").innerHTML = '<i class="fas fa-edit me-2"></i>เนเธเนเนเธเธเนเธญเธกเธนเธฅเธขเธฒ';
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

  function getShiftBatchTableRows() {
    const tbody = document.getElementById("shift-batch-tbody");
    return tbody ? Array.from(tbody.querySelectorAll("tr[data-drug-id]")) : [];
  }

  function updateShiftBatchRow(row) {
    if (!row) return;
    const ampInput = row.querySelector(".amp-remain-input");
    const emptyInput = row.querySelector(".empty-amp-input");
    const totalCell = row.querySelector(".count-total-cell");
    const resultCell = row.querySelector(".count-result-cell");
    const statusCell = row.querySelector(".count-status-cell");
    const actionBtn = row.querySelector(".row-save-btn");
    const target = parseFloat(row.dataset.target || "0");
    const unit = row.dataset.unit || "เธซเธเนเธงเธข";
    const ampValue = ampInput ? ampInput.value : "";
    const emptyValue = emptyInput ? emptyInput.value : "";
    const filled = isValidNumber(ampValue) && isValidNumber(emptyValue);
    const ampRemain = filled ? parseFloat(ampValue) : 0;
    const emptyAmp = filled ? parseFloat(emptyValue) : 0;
    const total = filled ? ampRemain + emptyAmp : null;
    const diff = filled ? total - target : null;

    row.dataset.completed = filled ? "1" : "0";
    row.dataset.match = filled && diff === 0 ? "1" : "0";
    row.dataset.difference = filled ? String(diff) : "";

    if (statusCell) {
      statusCell.innerHTML = filled
        ? '<span class="badge bg-success-subtle text-success px-2 py-1"><i class="fas fa-circle-check me-1"></i>โ— เธ•เธฃเธงเธเนเธฅเนเธง</span>'
        : '<span class="badge bg-danger-subtle text-danger px-2 py-1"><i class="fas fa-circle-xmark me-1"></i>โ— เธขเธฑเธเนเธกเนเธเธฑเธ</span>';
    }

    if (totalCell) {
      totalCell.textContent = filled ? String(total) : "-";
    }

    if (resultCell) {
      if (!filled) {
        resultCell.innerHTML = '<span class="text-muted">-</span>';
      } else if (diff === 0) {
        resultCell.innerHTML = '<span class="text-success fw-semibold">โ“ เธเธฃเธเธ–เนเธงเธ</span>';
      } else if (diff < 0) {
        resultCell.innerHTML = `<span class="text-danger fw-semibold">โ— เธขเธฒเธเธฒเธ” ${Math.abs(diff)} ${escapeHtml(unit)}</span>`;
      } else {
        resultCell.innerHTML = `<span class="text-danger fw-semibold">โ— เธขเธฒเน€เธเธดเธ ${diff} ${escapeHtml(unit)}</span>`;
      }
    }

    if (actionBtn) {
      actionBtn.disabled = !filled;
      actionBtn.innerHTML = row.dataset.saved === "1"
        ? '<i class="fas fa-pen-to-square me-1"></i>เนเธเนเนเธ'
        : '<i class="fas fa-floppy-disk me-1"></i>เธเธฑเธเธ—เธถเธ';
    }

    row.classList.remove("table-success", "table-danger", "table-warning");
    if (!filled) {
      row.classList.add("table-warning");
    } else if (diff === 0) {
      row.classList.add("table-success");
    } else {
      row.classList.add("table-danger");
    }
  }

  function updateShiftBatchSummary() {
    const rows = getShiftBatchTableRows();
    const total = rows.length;
    const completed = rows.filter(row => row.dataset.completed === "1").length;
    const mismatch = rows.filter(row => row.dataset.completed === "1" && row.dataset.match !== "1").length;
    const pending = total - completed;
    const ready = completed - mismatch;
    const summaryText = document.getElementById("shift-batch-summary-text");
    const summaryChecked = document.getElementById("shift-batch-summary-checked");
    const summaryPending = document.getElementById("shift-batch-summary-pending");
    const summaryMismatch = document.getElementById("shift-batch-summary-mismatch");
    const summaryReady = document.getElementById("shift-batch-summary-ready");
    const alertBox = document.getElementById("shift-batch-alert");
    const submitBtn = document.getElementById("btn-save-batch");

    if (summaryText) summaryText.textContent = `เธ•เธฃเธงเธเธชเธญเธเนเธฅเนเธง ${completed} เธเธฒเธ ${total} เธฃเธฒเธขเธเธฒเธฃ`;
    if (summaryChecked) summaryChecked.textContent = String(completed);
    if (summaryPending) summaryPending.textContent = String(pending);
    if (summaryMismatch) summaryMismatch.textContent = String(mismatch);
    if (summaryReady) summaryReady.textContent = String(ready);

    let alertType = "info";
    let alertMessage = "เธเธฃเนเธญเธกเธ•เธฃเธงเธเธเธฑเธเธ•เนเธญเนเธ”เนเธ—เธฑเธเธ—เธต";
    const disabled = total === 0 || pending > 0 || mismatch > 0 || window.__shiftCountLoadingState;

    if (pending > 0) {
      alertType = "warning";
      alertMessage = `เธขเธฑเธเธกเธต ${pending} เธฃเธฒเธขเธเธฒเธฃเธ—เธตเนเธขเธฑเธเนเธกเนเธเธฑเธเธเธฃเธ เธฃเธฐเธเธเธเธฐเนเธกเนเธญเธเธธเธเธฒเธ•เนเธซเนเธชเนเธเธขเธญเธ”เธเธเธเธงเนเธฒเธเธฐเธเธฃเธญเธเธเธฃเธเธ—เธธเธเนเธ–เธง`;
    } else if (mismatch > 0) {
      alertType = "danger";
      alertMessage = `เธเธ ${mismatch} เธฃเธฒเธขเธเธฒเธฃเธ—เธตเนเธเธฅเธฃเธงเธกเนเธกเนเธ•เธฃเธเธเธฑเธเธขเธญเธ”เน€เธเนเธฒเธซเธกเธฒเธข เธเธฃเธธเธ“เธฒเธ•เธฃเธงเธเธ—เธฒเธเธเนเธญเธเธชเนเธเน€เธงเธฃ`;
    } else if (total > 0) {
      alertType = "success";
      alertMessage = "เธเธฃเธเธ—เธธเธเนเธ–เธงเนเธฅเธฐเธเธฅเธ•เธฃเธงเธเธชเธญเธเธ•เธฃเธเธ—เธฑเนเธเธซเธกเธ” เธชเธฒเธกเธฒเธฃเธ–เธเธฑเธเธ—เธถเธเธชเนเธเธ•เธฃเธงเธเน€เธเนเธเธขเธญเธ”เนเธ”เน";
    }

    if (alertBox) {
      alertBox.className = `alert alert-${alertType} border-0 mb-0`;
      alertBox.textContent = alertMessage;
    }

    if (submitBtn) {
      submitBtn.disabled = disabled;
    }
  }

  function getShiftBatchPayload() {
    const selectedDate = document.getElementById("count-date-input")?.value || getBangkokDateString(new Date());
    const selectedShift = getSelectedShiftValue();
    const user = (document.getElementById("count-user-input")?.value || "").trim() || getCurrentUserName();
    const rows = getShiftBatchTableRows();

    return {
      Date: selectedDate,
      Shift: selectedShift,
      User: user,
      Items: rows.map(row => ({
        DrugID: row.dataset.drugId,
        AmpRemain: parseFloat(row.querySelector(".amp-remain-input")?.value || "0"),
        EmptyAmp: parseFloat(row.querySelector(".empty-amp-input")?.value || "0")
      }))
    };
  }

  async function saveShiftBatchRows(rowList) {
    const rows = Array.isArray(rowList) ? rowList : [];
    if (rows.length === 0) return;

    const payload = {
      Date: document.getElementById("count-date-input")?.value || getBangkokDateString(new Date()),
      Shift: getSelectedShiftValue(),
      User: (document.getElementById("count-user-input")?.value || "").trim() || getCurrentUserName(),
      Items: rows.map(row => ({
        DrugID: row.dataset.drugId,
        AmpRemain: parseFloat(row.querySelector(".amp-remain-input")?.value || "0"),
        EmptyAmp: parseFloat(row.querySelector(".empty-amp-input")?.value || "0")
      }))
    };

    showLoading(true);
    try {
      const response = await GASApi.saveShiftCountBatch(payload);
      showLoading(false);
      if (!response.success) {
        window.renderStockTable([]);
        return;
      }

      Swal.fire({
        icon: "success",
        title: "เธเธฑเธเธ—เธถเธเธชเธณเน€เธฃเนเธ",
        html: `เธเธฑเธเธ—เธถเธเนเธฅเนเธง <b>${escapeHtml(response.savedCount ?? rows.length)}</b> เธฃเธฒเธขเธเธฒเธฃ`
      });

      await window.__reloadShiftCountTable();
    } catch (error) {
      showLoading(false);
      Swal.fire("เน€เธเธทเนเธญเธกเธ•เนเธญเนเธกเนเธชเธณเน€เธฃเนเธ", error.toString(), "error");
    }
  }

  window.renderShiftCountTable = function (historyList) {
    const tbody = document.getElementById("shift-history-tbody");
    if (!tbody) return;

    destroyTableInstance("__shiftCountHistoryTable");
    tbody.closest("table")?.classList.add("stack-table-mobile");
    const rows = Array.isArray(historyList) ? historyList : [];
    if (rows.length === 0) {
      tbody.innerHTML = emptyTableRowHtml(8, "เธขเธฑเธเนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธ•เธฃเธงเธเธเธฑเธ");
      return;
    }

    tbody.innerHTML = rows.map(item => {
      const isCorrect = String(item.Result || "") === "เธ–เธนเธเธ•เนเธญเธ";
      return `
        <tr>
          <td data-label="เธงเธฑเธเธ—เธตเน">${escapeHtml(formatThaiDate(item.Date))}</td>
          <td data-label="เน€เธงเธฃ"><span class="badge bg-primary">${escapeHtml(getShiftLabel(item.Shift))}</span></td>
          <td data-label="เธเธทเนเธญเธขเธฒ">${escapeHtml(item.DrugName || "-")}</td>
          <td data-label="เนเธญเธกเธเนเธ”เธต" class="text-end">${escapeHtml(item.AmpRemain ?? 0)}</td>
          <td data-label="เนเธญเธกเธเนเน€เธเธฅเนเธฒ" class="text-end">${escapeHtml(item.EmptyAmp ?? 0)}</td>
          <td data-label="เธขเธญเธ”เธฃเธงเธก" class="text-end fw-semibold">${escapeHtml(item.ExpectedTotal ?? 0)}</td>
          <td data-label="เธเธฅเธ•เธฃเธงเธเธชเธญเธ" class="text-center ${isCorrect ? "text-success fw-semibold" : "text-danger fw-semibold"}">${isCorrect ? "โ“ เธเธฃเธเธ–เนเธงเธ" : "โ— เนเธกเนเธ•เธฃเธ"}</td>
          <td data-label="เธเธนเนเธเธฑเธเธ—เธถเธ">${escapeHtml(item.User || "-")}</td>
        </tr>
      `;
    }).join("");

    window.__shiftCountHistoryTable = $("#shift-history-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 10
    });
  };

  window.renderShiftBatchTable = function (masterList, historyList, selectedDate, selectedShift) {
    const tbody = document.getElementById("shift-batch-tbody");
    if (!tbody) return;

    tbody.closest("table")?.classList.add("stack-table-mobile");
    const masterRows = Array.isArray(masterList) ? masterList : [];
    const historyRows = Array.isArray(historyList) ? historyList : [];
    const map = new Map();
    historyRows.forEach(item => {
      if (getBangkokDateString(item.Date) === String(selectedDate || "") && String(item.Shift || "") === String(selectedShift || "")) {
        map.set(String(item.DrugID || ""), item);
      }
    });

    if (masterRows.length === 0) {
      tbody.innerHTML = emptyTableRowHtml(8, "เธขเธฑเธเนเธกเนเธกเธตเธฃเธฒเธขเธเธฒเธฃเธขเธฒเนเธเธฃเธฐเธเธ");
      updateShiftBatchSummary();
      return;
    }

    tbody.innerHTML = masterRows.map((item, index) => {
      const saved = map.get(String(item.DrugID || ""));
      const ampRemain = saved ? saved.AmpRemain ?? "" : "";
      const emptyAmp = saved ? saved.EmptyAmp ?? "" : "";
      const target = Number(item.StockWard || 0);
      const hasSaved = !!saved;
      const unit = item.Unit || "เธซเธเนเธงเธข";
      const total = isValidNumber(ampRemain) && isValidNumber(emptyAmp) ? Number(ampRemain) + Number(emptyAmp) : null;
      const diff = total === null ? null : total - target;
      const statusHtml = hasSaved
        ? '<span class="badge bg-success-subtle text-success px-2 py-1">โ— เธ•เธฃเธงเธเนเธฅเนเธง</span>'
        : '<span class="badge bg-danger-subtle text-danger px-2 py-1">โ— เธขเธฑเธเนเธกเนเธเธฑเธ</span>';
      const resultHtml = total === null
        ? '<span class="text-muted">-</span>'
        : diff === 0
          ? '<span class="text-success fw-semibold">โ“ เธเธฃเธเธ–เนเธงเธ</span>'
          : diff < 0
            ? `<span class="text-danger fw-semibold">โ— เธขเธฒเธเธฒเธ” ${Math.abs(diff)} ${escapeHtml(unit)}</span>`
            : `<span class="text-danger fw-semibold">โ— เธขเธฒเน€เธเธดเธ ${diff} ${escapeHtml(unit)}</span>`;

      return `
        <tr data-drug-id="${escapeHtml(item.DrugID || "")}" data-target="${escapeHtml(target)}" data-unit="${escapeHtml(unit)}" data-saved="${hasSaved ? "1" : "0"}">
          <td data-label="เธชเธ–เธฒเธเธฐ" class="count-status-cell">${statusHtml}</td>
          <td data-label="เธเธทเนเธญเธขเธฒ">
            <div class="fw-semibold">${escapeHtml(item.DrugName || "-")}</div>
            <small class="text-muted">${escapeHtml(item.Strength || "")}</small>
          </td>
          <td data-label="เธขเธญเธ”เน€เธเนเธฒเธซเธกเธฒเธข Stock" class="text-center fw-bold">${escapeHtml(target)}</td>
          <td data-label="เนเธญเธกเธเนเธ”เธต (เธเธฃเนเธญเธกเนเธเน)" style="min-width: 120px;"><input type="number" min="0" step="1" class="form-control form-control-sm amp-remain-input" value="${escapeHtml(ampRemain)}" data-row-index="${index}" inputmode="numeric" aria-label="เนเธญเธกเธเนเธ”เธต เนเธ–เธง ${index + 1}"></td>
          <td data-label="เนเธญเธกเธเนเน€เธเธฅเนเธฒ" style="min-width: 120px;"><input type="number" min="0" step="1" class="form-control form-control-sm empty-amp-input" value="${escapeHtml(emptyAmp)}" data-row-index="${index}" inputmode="numeric" aria-label="เนเธญเธกเธเนเน€เธเธฅเนเธฒ เนเธ–เธง ${index + 1}"></td>
          <td data-label="เธขเธญเธ”เธฃเธงเธกเธ—เธตเนเธเธฑเธเนเธ”เน" class="count-total-cell text-center fw-bold">${total === null ? "-" : escapeHtml(total)}</td>
          <td data-label="เธเธฅเธ•เธฃเธงเธเธชเธญเธ" class="count-result-cell text-center">${resultHtml}</td>
          <td data-label="Action" class="text-center">
            <button type="button" class="btn btn-primary-custom btn-sm row-save-btn" tabindex="-1">
              <i class="fas fa-floppy-disk me-1"></i>${hasSaved ? "เนเธเนเนเธ" : "เธเธฑเธเธ—เธถเธ"}
            </button>
          </td>
        </tr>
      `;
    }).join("");

    if (!tbody.dataset.bound) {
      tbody.dataset.bound = "1";
      tbody.addEventListener("input", function (event) {
        const row = event.target.closest("tr[data-drug-id]");
        if (!row) return;
        updateShiftBatchRow(row);
        updateShiftBatchSummary();
      });

      tbody.addEventListener("keydown", function (event) {
        const input = event.target.closest(".amp-remain-input, .empty-amp-input");
        if (!input || event.key !== "Tab") return;

        const row = input.closest("tr[data-drug-id]");
        if (!row) return;

        if (input.classList.contains("amp-remain-input") && !event.shiftKey) {
          event.preventDefault();
          row.querySelector(".empty-amp-input")?.focus();
          return;
        }

        if (input.classList.contains("empty-amp-input") && !event.shiftKey) {
          event.preventDefault();
          const rows = getShiftBatchTableRows();
          const currentIndex = rows.indexOf(row);
          const nextRow = rows[currentIndex + 1];
          if (nextRow) {
            nextRow.querySelector(".amp-remain-input")?.focus();
          } else {
            row.querySelector(".row-save-btn")?.focus();
          }
          return;
        }

        if (input.classList.contains("empty-amp-input") && event.shiftKey) {
          event.preventDefault();
          row.querySelector(".amp-remain-input")?.focus();
        }
      });

      tbody.addEventListener("click", function (event) {
        const button = event.target.closest(".row-save-btn");
        if (!button) return;
        const row = button.closest("tr[data-drug-id]");
        if (!row) return;
        if (row.dataset.completed !== "1") {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเนเธญเธกเธนเธฅเนเธซเนเธเธฃเธเธเนเธญเธเธเธฑเธเธ—เธถเธเนเธ–เธงเธเธตเน", "warning");
          return;
        }
        saveShiftBatchRows([row]);
      });
    }

    const renderedRows = getShiftBatchTableRows();
    renderedRows.forEach(updateShiftBatchRow);
    updateShiftBatchSummary();

    const firstInput = tbody.querySelector(".amp-remain-input");
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 0);
    }
  };

  async function loadShiftCountPageData() {
    const selectedDate = document.getElementById("count-date-input")?.value || getBangkokDateString(new Date());
    const selectedShift = getSelectedShiftValue();
    setInlineLoadingState("shift-batch-loading", true, "โปรดรอสักครู่ ระบบกำลังอัปเดตข้อมูลล่าสุด");
    const cachedMaster = Array.isArray(window.__shiftCountMasterCache) && window.__shiftCountMasterCache.length ? window.__shiftCountMasterCache : getDrugMasterCache();
    const cachedHistory = Array.isArray(window.__shiftCountHistoryCache) && window.__shiftCountHistoryCache.length ? window.__shiftCountHistoryCache : getShiftCountHistoryCache();

    if (cachedMaster.length || cachedHistory.length) {
      window.renderShiftBatchTable(cachedMaster, cachedHistory, selectedDate, selectedShift);
      window.renderShiftCountTable(cachedHistory.filter(item => getBangkokDateString(item.Date) === String(selectedDate || "") && String(item.Shift || "") === String(selectedShift || "")));
    } else {
      const batchTbody = document.getElementById("shift-batch-tbody");
      const historyTbody = document.getElementById("shift-history-tbody");
      renderEmptyRow(batchTbody, 8, "กำลังโหลดรายการยา...");
      renderEmptyRow(historyTbody, 8, "กำลังโหลดประวัติการตรวจนับ...");
    }

    const [masterRes, historyRes] = await Promise.allSettled([
      GASApi.getDrugMaster(),
      GASApi.getShiftCountHistory()
    ]);

    const masterOk = masterRes.status === "fulfilled" && masterRes.value && masterRes.value.success;
    const historyOk = historyRes.status === "fulfilled" && historyRes.value && historyRes.value.success;
    const masterRows = masterOk ? (masterRes.value.data || []) : cachedMaster;
    const historyRows = historyOk ? (historyRes.value.data || []) : cachedHistory;

    if (masterOk) {
      setDrugMasterCache(masterRows);
    }
    if (historyOk) {
      setShiftCountHistoryCache(historyRows);
    }

    window.__shiftCountMasterCache = Array.isArray(masterRows) ? masterRows : [];
    window.__shiftCountHistoryCache = Array.isArray(historyRows) ? historyRows : [];
    window.renderShiftBatchTable(window.__shiftCountMasterCache, window.__shiftCountHistoryCache, selectedDate, selectedShift);
    window.renderShiftCountTable(window.__shiftCountHistoryCache.filter(item => getBangkokDateString(item.Date) === String(selectedDate || "") && String(item.Shift || "") === String(selectedShift || "")));
    setInlineLoadingState("shift-batch-loading", false);
  }

  window.__reloadShiftCountTable = loadShiftCountPageData;

  window.initShiftCountPage = async function () {
    const dateInput = document.getElementById("count-date-input");
    const todayValue = getBangkokDateString(new Date());
    if (dateInput && !dateInput.value) {
      dateInput.value = todayValue;
    }

    const todayLabel = document.getElementById("shift-today-label");
    if (todayLabel) {
      todayLabel.textContent = `เธงเธฑเธเธ—เธตเนเธเธฑเธเธเธธเธเธฑเธ: ${formatThaiDate(new Date())}`;
    }

    const countUserInput = document.getElementById("count-user-input");
    if (countUserInput) {
      countUserInput.value = countUserInput.value || getCurrentUserName();
    }

    const savedShift = localStorage.getItem("shiftcount_shift") || "เน€เธเนเธฒ";
    const shiftRadio = document.querySelector(`input[name="shift-select"][value="${savedShift}"]`);
    if (shiftRadio) {
      shiftRadio.checked = true;
    }

    const refreshBtn = document.getElementById("btn-refresh-batch");
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "1";
      refreshBtn.addEventListener("click", async function () {
        await loadShiftCountPageData();
      });
    }

    const saveBtn = document.getElementById("btn-save-batch");
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = "1";
      saveBtn.addEventListener("click", async function () {
        const rows = getShiftBatchTableRows();
        const completedRows = rows.filter(row => row.dataset.completed === "1");
        const mismatchRows = rows.filter(row => row.dataset.completed === "1" && row.dataset.match !== "1");
        if (rows.length === 0) {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธขเธฑเธเนเธกเนเธกเธตเธฃเธฒเธขเธเธฒเธฃเธขเธฒเนเธซเนเธ•เธฃเธงเธเธเธฑเธ", "warning");
          return;
        }
        if (completedRows.length !== rows.length) {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเนเธญเธกเธนเธฅเนเธซเนเธเธฃเธเธ—เธธเธเนเธ–เธงเธเนเธญเธเธชเนเธเธขเธญเธ”", "warning");
          return;
        }
        if (mismatchRows.length > 0) {
          Swal.fire("เนเธเนเธเน€เธ•เธทเธญเธ", "เธขเธฑเธเธกเธตเธฃเธฒเธขเธเธฒเธฃเธ—เธตเนเธเธฅเธ•เธฃเธงเธเนเธกเนเธ•เธฃเธเธเธฑเธเธขเธญเธ”เน€เธเนเธฒเธซเธกเธฒเธข", "warning");
          return;
        }
        await saveShiftBatchRows(rows);
      });
    }

    document.querySelectorAll('input[name="shift-select"]').forEach(input => {
      if (!input.dataset.bound) {
        input.dataset.bound = "1";
        input.addEventListener("change", async function () {
          localStorage.setItem("shiftcount_shift", this.value);
          await loadShiftCountPageData();
        });
      }
    });

    if (dateInput && !dateInput.dataset.bound) {
      dateInput.dataset.bound = "1";
      dateInput.addEventListener("change", async function () {
        await loadShiftCountPageData();
      });
    }

    const countForm = document.getElementById("shift-count-form");
    if (countForm && !countForm.dataset.bound) {
      countForm.dataset.bound = "1";
      countForm.addEventListener("submit", function (event) {
        event.preventDefault();
      });
    }

    showLoading(true);
    try {
      await loadShiftCountPageData();
    } finally {
      showLoading(false);
    }
  };

  function renderDashboardChart(stockList) {
    const canvas = document.getElementById("stockChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (window.__dashboardChart && typeof window.__dashboardChart.destroy === "function") {
      window.__dashboardChart.destroy();
    }

    const rows = Array.isArray(stockList) ? stockList : [];
    const topRows = rows
      .filter(item => parseFloat(item.QtyRemain || 0) > 0)
      .sort((a, b) => parseFloat(b.QtyRemain || 0) - parseFloat(a.QtyRemain || 0))
      .slice(0, 8);
    const masterRows = Array.isArray(window.__drugMasterCache) && window.__drugMasterCache.length ? window.__drugMasterCache : getDrugMasterCache();
    const masterMap = new Map(masterRows.map(item => [String(item.DrugID || ""), item]));

    window.__dashboardChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: topRows.map(item => (masterMap.get(String(item.DrugID || ""))?.DrugName || item.DrugName || item.DrugID || "-")),
        datasets: [{
          label: "เธเธเน€เธซเธฅเธทเธญ",
          data: topRows.map(item => parseFloat(item.QtyRemain || 0)),
          backgroundColor: "#1A365D"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  function renderExpiryList(alerts) {
    const tbody = document.getElementById("expiry-list-tbody");
    if (!tbody) return;
    tbody.closest("table")?.classList.add("stack-table-mobile");
    const rows = Array.isArray(alerts) ? alerts : [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">เนเธกเนเธเธเธเนเธญเธกเธนเธฅเนเธเธฅเนเธซเธกเธ”เธญเธฒเธขเธธ</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(item => `
      <tr>
        <td data-label="เธเธทเนเธญเธขเธฒ">${escapeHtml(item.DrugName || "-")}</td>
        <td data-label="LOT"><span class="badge bg-secondary">${escapeHtml(item.LOT || "-")}</span></td>
        <td data-label="เธงเธฑเธเธเธเน€เธซเธฅเธทเธญ" class="text-center fw-semibold">${escapeHtml(item.DaysLeft ?? "-")}</td>
      </tr>
    `).join("");
  }

  async function loadDashboardData() {
    const [summaryRes, stockRes, alertRes, masterRes] = await Promise.allSettled([
      GASApi.getDashboardData(),
      GASApi.getDrugStock(),
      GASApi.checkExpiryAlert(),
      GASApi.getDrugMaster()
    ]);

    const summary = summaryRes.status === "fulfilled" ? summaryRes.value : null;
    const stock = stockRes.status === "fulfilled" ? stockRes.value : null;
    const alerts = alertRes.status === "fulfilled" ? alertRes.value : null;
    const master = masterRes.status === "fulfilled" ? masterRes.value : null;

    if (master && master.success && Array.isArray(master.data)) {
      setDrugMasterCache(master.data);
    }

    if (summary && summary.success && summary.data) {
      const summaryData = summary.data;
      const totalDrugs = document.getElementById("stat-total-drugs");
      const totalLots = document.getElementById("stat-total-lots");
      const nearExpiry = document.getElementById("stat-near-expiry");
      const todayDisbursement = document.getElementById("stat-today-disbursement");
      if (totalDrugs) totalDrugs.textContent = summaryData.totalDrugs ?? 0;
      if (totalLots) totalLots.textContent = summaryData.totalLots ?? 0;
      if (nearExpiry) nearExpiry.textContent = summaryData.nearExpiryCount ?? 0;
      if (todayDisbursement) todayDisbursement.textContent = summaryData.todayDisbursements ?? 0;
    }

    if (stock && stock.success) {
      renderDashboardChart(stock.data || []);
    }

    if (alerts && alerts.success) {
      renderExpiryList(alerts.data || []);
    }
  }

  window.initDashboardPage = async function () {
    const refreshBtn = document.getElementById("btn-refresh-dashboard");
    const shortcutBtn = document.getElementById("btn-shiftcount-shortcut");
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "1";
      refreshBtn.addEventListener("click", async function () {
        showLoading(true);
        try {
          await loadDashboardData();
        } catch (err) {
          Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", err.toString(), "error");
        } finally {
          showLoading(false);
        }
      });
    }
    if (shortcutBtn && !shortcutBtn.dataset.bound) {
      shortcutBtn.dataset.bound = "1";
      shortcutBtn.addEventListener("click", function () {
        window.location.href = "shiftcount.html";
      });
    }

    showLoading(true);
    try {
      await loadDashboardData();
    } catch (err) {
      Swal.fire("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”", err.toString(), "error");
    } finally {
      showLoading(false);
    }
  };
})();


