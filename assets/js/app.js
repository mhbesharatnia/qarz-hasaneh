(() => {
  const KEY = "qarz-fund-v1";
  const view = document.getElementById("view");
  const toastEl = document.getElementById("toast");
  const modalEl = document.getElementById("modal");

  const emptyPerson = () => ({
    firstName: "",
    lastName: "",
    fatherName: "",
    nationalId: "",
    gender: "male",
    birthDate: "",
    mobile: "",
    phone: "",
    job: "",
    workplace: "",
    address: "",
  });

  const emptyDocs = () => ({
    nationalCard: null,
    identityBook: null,
    extra: null,
  });

  const state = {
    loans: load(),
    draft: null,
    step: 0,
  };

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state.loans));
  }

  function uid() {
    return "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    setTimeout(() => (toastEl.style.display = "none"), 2600);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toFa(n) {
    return new Intl.NumberFormat("fa-IR").format(Number(n) || 0);
  }

  function faDigits(s) {
    return String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function titleOf(p) {
    return (p.gender === "female" ? "خانم" : "آقا") + " " + fullName(p);
  }

  function fullName(p) {
    return `${p.firstName || ""} ${p.lastName || ""}`.trim() || "—";
  }

  function phonesOf(p) {
    return [p.mobile, p.phone].filter(Boolean);
  }

  /* ---- Jalali ---- */
  function g2j(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = gy <= 1600 ? 0 : 979;
    gy -= gy <= 1600 ? 621 : 1600;
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days =
      365 * gy +
      Math.floor((gy2 + 3) / 4) -
      Math.floor((gy2 + 99) / 100) +
      Math.floor((gy2 + 399) / 400) -
      80 +
      gd +
      g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return { jy, jm, jd };
  }

  function j2g(jy, jm, jd) {
    let gy = jy <= 979 ? 621 : 1600;
    jy -= jy <= 979 ? 0 : 979;
    const days =
      365 * jy +
      Math.floor(jy / 33) * 8 +
      Math.floor(((jy % 33) + 3) / 4) +
      78 +
      jd +
      (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    gy += 400 * Math.floor(days / 146097);
    let d = days % 146097;
    if (d >= 36525) {
      d--;
      gy += 100 * Math.floor(d / 36524);
      d %= 36524;
      if (d >= 365) d++;
    }
    gy += 4 * Math.floor(d / 1461);
    d %= 1461;
    if (d >= 366) {
      gy += Math.floor((d - 1) / 365);
      d = (d - 1) % 365;
    }
    const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0;
    for (gm = 1; gm <= 12 && d >= sal_a[gm]; gm++) d -= sal_a[gm];
    return { gy, gm, gd: d + 1 };
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return { y, m, d };
  }

  function isoToJalali(iso) {
    if (!iso) return "—";
    const { y, m, d } = parseISO(iso.slice(0, 10));
    const j = g2j(y, m, d);
    return faDigits(`${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`);
  }

  function todayISO() {
    const t = new Date();
    return t.toISOString().slice(0, 10);
  }

  function addMonthsISO(iso, n) {
    const { y, m, d } = parseISO(iso);
    const dt = new Date(Date.UTC(y, m - 1 + n, d));
    return dt.toISOString().slice(0, 10);
  }

  function daysBetween(a, b) {
    const da = new Date(a + "T00:00:00");
    const db = new Date(b + "T00:00:00");
    return Math.floor((db - da) / 86400000);
  }

  function buildInstallments(amount, months, startDate) {
    const base = Math.floor(amount / months);
    const rem = amount - base * months;
    const rows = [];
    for (let i = 0; i < months; i++) {
      rows.push({
        n: i + 1,
        dueDate: addMonthsISO(startDate, i),
        amount: base + (i === months - 1 ? rem : 0),
        payments: [],
      });
    }
    return rows;
  }

  function paidOf(inst) {
    return inst.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  }

  function instStatus(inst) {
    const paid = paidOf(inst);
    if (paid >= inst.amount) return "paid";
    const late = daysBetween(inst.dueDate, todayISO());
    if (late > 0) return "late";
    return "open";
  }

  function overdueAlerts(loan) {
    return loan.installments
      .filter((i) => instStatus(i) !== "paid")
      .map((i) => ({ inst: i, days: daysBetween(i.dueDate, todayISO()) }))
      .filter((x) => x.days >= 5);
  }

  function isSettled(loan) {
    return loan.installments.every((i) => paidOf(i) >= i.amount);
  }

  async function fileToData(file) {
    if (!file) return null;
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () =>
        res({ name: file.name, type: file.type, data: r.result, size: file.size });
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function filePreview(file) {
    if (!file) return "";
    if (file.type && file.type.startsWith("image/")) {
      return `<img src="${file.data}" alt="${escapeHtml(file.name)}" />`;
    }
    return `<div class="file-chip">${escapeHtml(file.name)}</div>`;
  }

  /* ---- routing ---- */
  function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const parts = hash.split("/").filter(Boolean);
    if (parts[0] === "new") return renderNew();
    if (parts[0] === "loan" && parts[1]) return renderLoan(parts[1]);
    if (parts[0] === "letter" && parts[1]) return renderLetter(parts[1]);
    return renderHome();
  }

  window.addEventListener("hashchange", route);

  /* ---- home ---- */
  function renderHome() {
    const alerts = [];
    state.loans.forEach((loan) => {
      overdueAlerts(loan).forEach((a) => {
        alerts.push({ loan, ...a });
      });
    });

    const active = state.loans.filter((l) => !isSettled(l)).length;
    const settled = state.loans.filter(isSettled).length;
    const total = state.loans.reduce((s, l) => s + Number(l.amount), 0);

    view.innerHTML = `
      ${
        alerts.length
          ? alerts
              .map(
                (a) => `
        <div class="alert alert-warn">
          <h3>${faDigits(a.days)} روز از تاریخ سررسید قسط ${escapeHtml(titleOf(a.loan.recipient))} گذشته است</h3>
          <p>قسط ${faDigits(a.inst.n)} به مبلغ ${toFa(a.inst.amount)} تومان — سررسید ${isoToJalali(a.inst.dueDate)}</p>
          <div class="phones">
            ${phonesOf(a.loan.recipient)
              .map((p) => `<span class="chip">تماس: ${faDigits(p)}</span>`)
              .join("") || `<span class="chip">شماره تلفنی ثبت نشده</span>`}
          </div>
          <div class="actions">
            <a class="btn btn-sm btn-primary" href="#/loan/${a.loan.id}">مشاهده پرونده</a>
          </div>
        </div>`
              )
              .join("")
          : `<div class="alert alert-ok"><b>هشدار معوق ندارید.</b> اگر ۵ روز از سررسید قسطی بگذرد، اینجا نمایش داده می‌شود.</div>`
      }

      <div class="grid grid-3" style="margin:18px 0">
        <div class="stat"><span>وام‌های جاری</span><b>${toFa(active)}</b></div>
        <div class="stat"><span>تسویه‌شده</span><b>${toFa(settled)}</b></div>
        <div class="stat"><span>جمع مبالغ وام</span><b>${toFa(total)} تومان</b></div>
      </div>

      <div class="card">
        <h2 class="section-title">پرونده‌ها</h2>
        ${
          state.loans.length === 0
            ? `<div class="empty">هنوز وامی ثبت نشده. از «ثبت وام جدید» شروع کنید.</div>`
            : `<div class="loan-list">${state.loans
                .map((l) => {
                  const st = isSettled(l) ? "done" : overdueAlerts(l).length ? "late" : "active";
                  const label = st === "done" ? "تسویه" : st === "late" ? "معوق" : "جاری";
                  return `<div class="loan-row" data-id="${l.id}">
                    <div>
                      <b>${escapeHtml(titleOf(l.recipient))}</b>
                      <div class="hint">مبلغ ${toFa(l.amount)} تومان · ${faDigits(l.months)} قسط · ضمانت: ${l.guarantee.type === "check" ? "چک" : "سفته"}</div>
                    </div>
                    <span class="badge badge-${st}">${label}</span>
                  </div>`;
                })
                .join("")}</div>`
        }
      </div>
    `;
    view.querySelectorAll(".loan-row").forEach((el) => {
      el.onclick = () => (location.hash = "#/loan/" + el.dataset.id);
    });
  }

  /* ---- new loan ---- */
  const STEPS = ["دریافت‌کننده", "معرف", "ضامن", "مدارک و ضمانت", "وام و اقساط"];

  function newDraft() {
    return {
      recipient: emptyPerson(),
      introducer: emptyPerson(),
      guarantor: emptyPerson(),
      docs: {
        recipient: emptyDocs(),
        introducer: emptyDocs(),
        guarantor: emptyDocs(),
        introducerLetter: null,
        guarantorLetter: null,
        guaranteeScan: null,
      },
      guarantee: { type: "check", received: false, number: "", bank: "", note: "" },
      amount: "",
      months: "",
      firstDue: todayISO(),
    };
  }

  function personFields(prefix, p, required = true) {
    const req = required ? "required" : "";
    return `
      <div class="grid grid-2">
        <div class="field"><label>نام</label><input ${req} data-p="${prefix}" data-k="firstName" value="${escapeHtml(p.firstName)}" /></div>
        <div class="field"><label>نام خانوادگی</label><input ${req} data-p="${prefix}" data-k="lastName" value="${escapeHtml(p.lastName)}" /></div>
        <div class="field"><label>نام پدر</label><input ${req} data-p="${prefix}" data-k="fatherName" value="${escapeHtml(p.fatherName)}" /></div>
        <div class="field"><label>جنسیت</label>
          <select data-p="${prefix}" data-k="gender">
            <option value="male" ${p.gender === "male" ? "selected" : ""}>آقا</option>
            <option value="female" ${p.gender === "female" ? "selected" : ""}>خانم</option>
          </select>
        </div>
        <div class="field"><label>کد ملی</label><input ${req} data-p="${prefix}" data-k="nationalId" value="${escapeHtml(p.nationalId)}" /></div>
        <div class="field"><label>تاریخ تولد</label><input type="date" data-p="${prefix}" data-k="birthDate" value="${escapeHtml(p.birthDate)}" /></div>
        <div class="field"><label>موبایل</label><input type="tel" ${req} data-p="${prefix}" data-k="mobile" value="${escapeHtml(p.mobile)}" /></div>
        <div class="field"><label>تلفن ثابت</label><input type="tel" data-p="${prefix}" data-k="phone" value="${escapeHtml(p.phone)}" /></div>
        <div class="field"><label>شغل</label><input data-p="${prefix}" data-k="job" value="${escapeHtml(p.job)}" /></div>
        <div class="field"><label>محل کار</label><input data-p="${prefix}" data-k="workplace" value="${escapeHtml(p.workplace)}" /></div>
      </div>
      <div class="field"><label>نشانی کامل</label><textarea data-p="${prefix}" data-k="address">${escapeHtml(p.address)}</textarea></div>
    `;
  }

  function docFields(prefix, docs, optional) {
    const opt = optional ? `<span class="optional">اختیاری</span>` : "";
    return `
      <div class="grid grid-3">
        <div class="field file-box"><label>اسکن کارت ملی ${opt}</label>
          <input type="file" accept="image/*,.pdf" data-doc="${prefix}" data-dk="nationalCard" />
          <div class="preview">${filePreview(docs.nationalCard)}</div>
        </div>
        <div class="field file-box"><label>اسکن شناسنامه ${opt}</label>
          <input type="file" accept="image/*,.pdf" data-doc="${prefix}" data-dk="identityBook" />
          <div class="preview">${filePreview(docs.identityBook)}</div>
        </div>
        <div class="field file-box"><label>سایر مدارک ${opt}</label>
          <input type="file" accept="image/*,.pdf" data-doc="${prefix}" data-dk="extra" />
          <div class="preview">${filePreview(docs.extra)}</div>
        </div>
      </div>
    `;
  }

  function bindDraft(root) {
    root.querySelectorAll("[data-p]").forEach((el) => {
      el.oninput = el.onchange = () => {
        state.draft[el.dataset.p][el.dataset.k] = el.value;
      };
    });
    root.querySelectorAll("[data-g]").forEach((el) => {
      el.oninput = el.onchange = () => {
        const v = el.type === "checkbox" ? el.checked : el.value;
        state.draft.guarantee[el.dataset.g] = v;
      };
    });
    root.querySelectorAll("[data-loan]").forEach((el) => {
      el.oninput = () => {
        state.draft[el.dataset.loan] = el.value;
        if (el.dataset.loan === "amount" || el.dataset.loan === "months" || el.dataset.loan === "firstDue") {
          refreshPreview();
        }
      };
    });
    root.querySelectorAll("[data-doc]").forEach((el) => {
      el.onchange = async () => {
        const file = await fileToData(el.files[0]);
        const group = el.dataset.doc;
        const key = el.dataset.dk;
        if (group === "letters") state.draft.docs[key] = file;
        else state.draft.docs[group][key] = file;
        el.parentElement.querySelector(".preview").innerHTML = filePreview(file);
      };
    });
  }

  function previewTable() {
    const amount = Number(state.draft.amount);
    const months = Number(state.draft.months);
    if (!amount || !months || months < 1) return `<p class="hint">مبلغ وام و تعداد ماه را وارد کنید تا جدول اقساط ساخته شود.</p>`;
    const rows = buildInstallments(amount, months, state.draft.firstDue || todayISO());
    return `<div class="table-wrap"><table>
      <thead><tr><th>قسط</th><th>سررسید</th><th>مبلغ (تومان)</th></tr></thead>
      <tbody>${rows
        .map((r) => `<tr><td>${faDigits(r.n)}</td><td>${isoToJalali(r.dueDate)}</td><td>${toFa(r.amount)}</td></tr>`)
        .join("")}</tbody>
    </table></div>
    <div class="actions">
      <button type="button" class="btn btn-gold" id="excel-preview">خروجی اکسل جدول اقساط</button>
    </div>`;
  }

  function refreshPreview() {
    const box = document.getElementById("inst-preview");
    if (!box) return;
    box.innerHTML = previewTable();
    const btn = document.getElementById("excel-preview");
    if (btn) btn.onclick = () => exportExcelFromDraft();
  }

  function exportExcelFromDraft() {
    const amount = Number(state.draft.amount);
    const months = Number(state.draft.months);
    if (!amount || !months) return toast("ابتدا مبلغ و تعداد ماه را مشخص کنید");
    const rows = buildInstallments(amount, months, state.draft.firstDue || todayISO());
    downloadExcel(fullName(state.draft.recipient) || "وام", amount, months, rows);
  }

  function downloadExcel(name, amount, months, rows, paymentsMap) {
    if (!window.XLSX) return toast("کتابخانه اکسل بارگذاری نشد");
    const data = [
      ["صندوق قرض‌الحسنه — جدول اقساط"],
      ["دریافت‌کننده", name],
      ["مبلغ وام (تومان)", amount],
      ["تعداد اقساط", months],
      [],
      ["شماره قسط", "تاریخ سررسید (شمسی)", "مبلغ قسط", "پرداخت‌شده", "مانده", "وضعیت"],
    ];
    rows.forEach((r) => {
      const paid = paymentsMap ? paidOf(r) : 0;
      data.push([
        r.n,
        isoToJalali(r.dueDate).replace(/[۰-۹]/g, (c) => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(c)]),
        r.amount,
        paid,
        Math.max(0, r.amount - paid),
        paymentsMap ? (paid >= r.amount ? "تسویه" : instStatus(r) === "late" ? "معوق" : "باز") : "برنامه",
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "اقساط");
    XLSX.writeFile(wb, `aqsat-${name.replace(/\s+/g, "-")}.xlsx`);
  }

  function renderNew() {
    if (!state.draft) state.draft = newDraft();
    const d = state.draft;
    const s = state.step;
    let body = "";
    if (s === 0) {
      body = `<h2 class="section-title">مشخصات دریافت‌کننده وام</h2>${personFields("recipient", d.recipient, true)}`;
    } else if (s === 1) {
      body = `<h2 class="section-title">مشخصات معرف</h2>
        <p class="hint">مدارک معرف اختیاری است؛ مشخصات هویتی را وارد کنید.</p>
        ${personFields("introducer", d.introducer, true)}`;
    } else if (s === 2) {
      body = `<h2 class="section-title">مشخصات ضامن</h2>${personFields("guarantor", d.guarantor, true)}`;
    } else if (s === 3) {
      body = `
        <h2 class="section-title">اسکن مدارک دریافت‌کننده</h2>
        ${docFields("recipient", d.docs.recipient, false)}
        <h2 class="section-title">اسکن مدارک معرف <span class="optional">اختیاری</span></h2>
        ${docFields("introducer", d.docs.introducer, true)}
        <h2 class="section-title">اسکن مدارک ضامن</h2>
        ${docFields("guarantor", d.docs.guarantor, false)}
        <div class="grid grid-2">
          <div class="field file-box"><label>نامه معرف</label>
            <input type="file" accept="image/*,.pdf" data-doc="letters" data-dk="introducerLetter" />
            <div class="preview">${filePreview(d.docs.introducerLetter)}</div>
          </div>
          <div class="field file-box"><label>نامه تایید ضامن</label>
            <input type="file" accept="image/*,.pdf" data-doc="letters" data-dk="guarantorLetter" />
            <div class="preview">${filePreview(d.docs.guarantorLetter)}</div>
          </div>
        </div>
        <h2 class="section-title">ضمانت</h2>
        <div class="grid grid-2">
          <div class="field"><label>نوع ضمانت</label>
            <select data-g="type">
              <option value="check" ${d.guarantee.type === "check" ? "selected" : ""}>چک ضمانت</option>
              <option value="promissory" ${d.guarantee.type === "promissory" ? "selected" : ""}>سفته ضمانت</option>
            </select>
          </div>
          <div class="field"><label>شماره چک / سفته</label><input data-g="number" value="${escapeHtml(d.guarantee.number)}" /></div>
          <div class="field"><label>بانک / محل صدور</label><input data-g="bank" value="${escapeHtml(d.guarantee.bank)}" /></div>
          <div class="field" style="display:flex;align-items:center;gap:8px;padding-top:22px">
            <input type="checkbox" data-g="received" ${d.guarantee.received ? "checked" : ""} id="g-rec" />
            <label for="g-rec" style="margin:0">تایید می‌کنم چک یا سفته ضمانت دریافت شد</label>
          </div>
        </div>
        <div class="field file-box"><label>اسکن چک / سفته ضمانت</label>
          <input type="file" accept="image/*,.pdf" data-doc="letters" data-dk="guaranteeScan" />
          <div class="preview">${filePreview(d.docs.guaranteeScan)}</div>
        </div>
        <div class="field"><label>توضیحات ضمانت</label><textarea data-g="note">${escapeHtml(d.guarantee.note)}</textarea></div>
      `;
    } else {
      body = `
        <h2 class="section-title">مبلغ وام و بازپرداخت</h2>
        <div class="grid grid-3">
          <div class="field"><label>مبلغ وام (تومان)</label><input type="number" min="1" data-loan="amount" value="${escapeHtml(d.amount)}" /></div>
          <div class="field"><label>تعداد ماه بازپرداخت</label><input type="number" min="1" data-loan="months" value="${escapeHtml(d.months)}" /></div>
          <div class="field"><label>تاریخ سررسید قسط اول</label><input type="date" data-loan="firstDue" value="${escapeHtml(d.firstDue)}" /></div>
        </div>
        <p class="hint">با تعیین مبلغ و تعداد ماه، تاریخ سررسید و مبلغ هر قسط محاسبه می‌شود. باقی‌مانده تقسیم روی قسط آخر می‌نشیند.</p>
        <div id="inst-preview">${previewTable()}</div>
      `;
    }

    view.innerHTML = `
      <div class="stepper">${STEPS.map((t, i) => `<div class="step ${i === s ? "on" : ""}">${faDigits(i + 1)}. ${t}</div>`).join("")}</div>
      <form class="card" id="loan-form">${body}
        <div class="actions">
          ${s > 0 ? `<button type="button" class="btn btn-ghost" id="prev">قبلی</button>` : ""}
          ${s < STEPS.length - 1 ? `<button type="submit" class="btn btn-primary">ادامه</button>` : `<button type="submit" class="btn btn-primary">ثبت پرونده</button>`}
          <a class="btn btn-ghost" href="#/">انصراف</a>
        </div>
      </form>
    `;
    bindDraft(view);
    const prev = document.getElementById("prev");
    if (prev)
      prev.onclick = () => {
        state.step--;
        renderNew();
      };
    const excel = document.getElementById("excel-preview");
    if (excel) excel.onclick = () => exportExcelFromDraft();
    document.getElementById("loan-form").onsubmit = (e) => {
      e.preventDefault();
      if (s < STEPS.length - 1) {
        if (s === 3 && !state.draft.guarantee.received) {
          toast("دریافت چک یا سفته ضمانت باید تایید شود");
          return;
        }
        state.step++;
        renderNew();
        return;
      }
      commitLoan();
    };
  }

  function commitLoan() {
    const d = state.draft;
    const amount = Number(d.amount);
    const months = Number(d.months);
    if (!d.recipient.firstName || !d.recipient.lastName || !d.recipient.mobile) {
      toast("نام و موبایل دریافت‌کننده الزامی است");
      state.step = 0;
      renderNew();
      return;
    }
    if (!amount || !months) {
      toast("مبلغ و تعداد ماه را کامل کنید");
      return;
    }
    if (!d.guarantee.received) {
      toast("تایید دریافت ضمانت لازم است");
      return;
    }
    const loan = {
      id: uid(),
      createdAt: new Date().toISOString(),
      recipient: { ...d.recipient },
      introducer: { ...d.introducer },
      guarantor: { ...d.guarantor },
      docs: d.docs,
      guarantee: { ...d.guarantee },
      amount,
      months,
      firstDue: d.firstDue,
      installments: buildInstallments(amount, months, d.firstDue),
    };
    state.loans.unshift(loan);
    save();
    state.draft = null;
    state.step = 0;
    toast("پرونده ثبت شد");
    location.hash = "#/loan/" + loan.id;
  }

  /* ---- loan detail ---- */
  function personCard(title, p, docs, optionalDocs) {
    return `<div class="card">
      <h3 class="section-title">${title}</h3>
      <p><b>${escapeHtml(titleOf(p))}</b> فرزند ${escapeHtml(p.fatherName || "—")} · کد ملی ${faDigits(p.nationalId || "—")}</p>
      <p class="hint">${escapeHtml(p.job || "")} ${p.workplace ? "— " + escapeHtml(p.workplace) : ""}</p>
      <p>نشانی: ${escapeHtml(p.address || "—")}</p>
      <div class="phones">${phonesOf(p).map((x) => `<span class="chip">${faDigits(x)}</span>`).join("")}</div>
      <div class="preview" style="margin-top:12px">
        ${filePreview(docs.nationalCard)}${filePreview(docs.identityBook)}${filePreview(docs.extra)}
      </div>
      ${optionalDocs ? `<p class="hint">مدارک معرف اختیاری است.</p>` : ""}
    </div>`;
  }

  function renderLoan(id) {
    const loan = state.loans.find((l) => l.id === id);
    if (!loan) {
      view.innerHTML = `<div class="card empty">پرونده پیدا نشد. <a href="#/">بازگشت</a></div>`;
      return;
    }
    const alerts = overdueAlerts(loan);
    const settled = isSettled(loan);

    view.innerHTML = `
      <div class="no-print">
        ${
          alerts
            .map(
              (a) => `<div class="alert alert-warn">
            <h3>${faDigits(a.days)} روز از تاریخ سررسید قسط ${escapeHtml(titleOf(loan.recipient))} گذشته است</h3>
            <p>قسط ${faDigits(a.inst.n)} — سررسید ${isoToJalali(a.inst.dueDate)}</p>
            <div class="phones">${phonesOf(loan.recipient).map((p) => `<span class="chip">تماس: ${faDigits(p)}</span>`).join("")}</div>
          </div>`
            )
            .join("")
        }
        ${
          settled
            ? `<div class="alert alert-gold">تمام اقساط تسویه شده است.
              <a class="btn btn-sm btn-gold" href="#/letter/${loan.id}">صدور نامه تایید تسویه</a></div>`
            : ""
        }
        <div class="actions" style="margin-top:0">
          <a class="btn btn-ghost" href="#/">بازگشت</a>
          <button class="btn btn-gold" id="excel-loan">خروجی اکسل اقساط</button>
          ${settled ? `<a class="btn btn-primary" href="#/letter/${loan.id}">نامه تسویه</a>` : ""}
          <button class="btn btn-danger" id="del-loan">حذف پرونده</button>
        </div>
        <div class="grid grid-3" style="margin:16px 0">
          <div class="stat"><span>مبلغ وام</span><b>${toFa(loan.amount)}</b></div>
          <div class="stat"><span>تعداد اقساط</span><b>${toFa(loan.months)}</b></div>
          <div class="stat"><span>ضمانت</span><b>${loan.guarantee.type === "check" ? "چک" : "سفته"} ${loan.guarantee.received ? "دریافت شد" : ""}</b></div>
        </div>
        <div class="grid grid-3">
          ${personCard("دریافت‌کننده", loan.recipient, loan.docs.recipient)}
          ${personCard("معرف", loan.introducer, loan.docs.introducer, true)}
          ${personCard("ضامن", loan.guarantor, loan.docs.guarantor)}
        </div>
        <div class="card" style="margin-top:16px">
          <h3 class="section-title">نامه‌ها و ضمانت</h3>
          <p>شماره سند ضمانت: ${faDigits(loan.guarantee.number || "—")} · ${escapeHtml(loan.guarantee.bank || "")}</p>
          <div class="preview">
            ${filePreview(loan.docs.introducerLetter)}
            ${filePreview(loan.docs.guarantorLetter)}
            ${filePreview(loan.docs.guaranteeScan)}
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <h3 class="section-title">جدول اقساط</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>قسط</th><th>سررسید</th><th>مبلغ</th><th>واریزی</th><th>مانده</th><th>وضعیت</th><th></th></tr></thead>
            <tbody>
              ${loan.installments
                .map((i) => {
                  const paid = paidOf(i);
                  const st = instStatus(i);
                  const label = st === "paid" ? "تسویه" : st === "late" ? "معوق" : "باز";
                  return `<tr>
                    <td>${faDigits(i.n)}</td>
                    <td>${isoToJalali(i.dueDate)}</td>
                    <td>${toFa(i.amount)}</td>
                    <td>${toFa(paid)}</td>
                    <td>${toFa(Math.max(0, i.amount - paid))}</td>
                    <td><span class="badge badge-${st === "paid" ? "done" : st === "late" ? "late" : "active"}">${label}</span></td>
                    <td><button class="btn btn-sm btn-primary" data-pay="${i.n}">ثبت واریز</button></td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table></div>
        </div>
        <div class="card" style="margin-top:16px">
          <h3 class="section-title">سوابق واریز</h3>
          ${renderPayments(loan)}
        </div>
      </div>
    `;
    document.getElementById("excel-loan").onclick = () =>
      downloadExcel(fullName(loan.recipient), loan.amount, loan.months, loan.installments, true);
    document.getElementById("del-loan").onclick = () => {
      if (!confirm("این پرونده حذف شود؟")) return;
      state.loans = state.loans.filter((x) => x.id !== loan.id);
      save();
      location.hash = "#/";
    };
    view.querySelectorAll("[data-pay]").forEach((btn) => {
      btn.onclick = () => openPay(loan.id, Number(btn.dataset.pay));
    });
  }

  function renderPayments(loan) {
    const all = [];
    loan.installments.forEach((i) =>
      i.payments.forEach((p) => all.push({ ...p, n: i.n }))
    );
    if (!all.length) return `<p class="hint">هنوز واریزی ثبت نشده است.</p>`;
    return `<div class="table-wrap"><table>
      <thead><tr><th>قسط</th><th>مبلغ</th><th>زمان</th><th>روش</th><th>کد رهگیری</th><th>رسید</th><th>توضیح</th></tr></thead>
      <tbody>${all
        .map(
          (p) => `<tr>
            <td>${faDigits(p.n)}</td>
            <td>${toFa(p.amount)}</td>
            <td>${faDigits((p.at || "").replace("T", " ").slice(0, 16))}</td>
            <td>${escapeHtml(methodLabel(p.method))}</td>
            <td>${faDigits(p.tracking || "—")}</td>
            <td>${p.receipt ? filePreview(p.receipt) : "—"}</td>
            <td>${escapeHtml(p.note || "")}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table></div>`;
  }

  function methodLabel(m) {
    return (
      {
        card: "کارت به کارت",
        satna: "ساتنا / پایا",
        cash: "نقد",
        cheque: "چک",
        other: "سایر",
      }[m] || m || "—"
    );
  }

  function openPay(loanId, n) {
    const loan = state.loans.find((l) => l.id === loanId);
    const inst = loan.installments.find((i) => i.n === n);
    const remain = Math.max(0, inst.amount - paidOf(inst));
    modalEl.classList.add("show");
    modalEl.innerHTML = `<div class="modal">
      <h3>ثبت واریز قسط ${faDigits(n)}</h3>
      <p class="hint">مانده این قسط: ${toFa(remain)} تومان</p>
      <div class="field"><label>مبلغ واریزی (تومان)</label><input type="number" id="p-amount" value="${remain}" /></div>
      <div class="field"><label>زمان واریز</label><input type="datetime-local" id="p-at" /></div>
      <div class="field"><label>روش واریز</label>
        <select id="p-method">
          <option value="card">کارت به کارت</option>
          <option value="satna">ساتنا / پایا</option>
          <option value="cash">نقد</option>
          <option value="cheque">چک</option>
          <option value="other">سایر</option>
        </select>
      </div>
      <div class="field"><label>کد رهگیری</label><input id="p-track" /></div>
      <div class="field file-box"><label>عکس رسید واریزی</label>
        <input type="file" accept="image/*,.pdf" id="p-receipt" />
        <div class="preview" id="p-prev"></div>
      </div>
      <div class="field"><label>توضیحات</label><textarea id="p-note"></textarea></div>
      <div class="actions">
        <button class="btn btn-primary" id="p-save">ثبت</button>
        <button class="btn btn-ghost" id="p-cancel">بستن</button>
      </div>
    </div>`;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById("p-at").value = now.toISOString().slice(0, 16);
    let receipt = null;
    document.getElementById("p-receipt").onchange = async (e) => {
      receipt = await fileToData(e.target.files[0]);
      document.getElementById("p-prev").innerHTML = filePreview(receipt);
    };
    document.getElementById("p-cancel").onclick = closeModal;
    modalEl.onclick = (e) => {
      if (e.target === modalEl) closeModal();
    };
    document.getElementById("p-save").onclick = () => {
      const amount = Number(document.getElementById("p-amount").value);
      if (!amount) return toast("مبلغ واریز را وارد کنید");
      inst.payments.push({
        amount,
        at: document.getElementById("p-at").value,
        method: document.getElementById("p-method").value,
        tracking: document.getElementById("p-track").value.trim(),
        receipt,
        note: document.getElementById("p-note").value.trim(),
      });
      save();
      closeModal();
      toast("واریز ثبت شد");
      if (isSettled(loan)) {
        toast("اقساط کامل شد — نامه تسویه آماده است");
        location.hash = "#/letter/" + loan.id;
      } else renderLoan(loan.id);
    };
  }

  function closeModal() {
    modalEl.classList.remove("show");
    modalEl.innerHTML = "";
  }

  function renderLetter(id) {
    const loan = state.loans.find((l) => l.id === id);
    if (!loan) {
      view.innerHTML = `<div class="card empty">پرونده پیدا نشد.</div>`;
      return;
    }
    if (!isSettled(loan)) {
      view.innerHTML = `<div class="card">هنوز همه اقساط تسویه نشده است. <a href="#/loan/${loan.id}">بازگشت</a></div>`;
      return;
    }
    const g = loan.guarantee.type === "check" ? "چک ضمانت" : "سفته ضمانت";
    const today = isoToJalali(todayISO());
    view.innerHTML = `
      <div class="actions no-print">
        <a class="btn btn-ghost" href="#/loan/${loan.id}">بازگشت به پرونده</a>
        <button class="btn btn-primary" onclick="window.print()">چاپ نامه</button>
      </div>
      <article class="letter">
        <div class="meta"><span>صندوق قرض‌الحسنه</span><span>تاریخ: ${today}</span></div>
        <h2>نامه تایید تسویه اقساط</h2>
        <p>بدین‌وسیله تایید می‌گردد که ${escapeHtml(titleOf(loan.recipient))} فرزند ${escapeHtml(loan.recipient.fatherName || "—")} به شماره ملی ${faDigits(loan.recipient.nationalId || "—")} تمامی اقساط وام به مبلغ ${toFa(loan.amount)} تومان را در ${faDigits(loan.months)} قسط به‌طور کامل پرداخت و تسویه نموده است.</p>
        <p>با توجه به پایان تعهدات نام‌برده، به <b>مدیر حسابداری</b> اعلام می‌گردد که ${g} ایشان به شماره ${faDigits(loan.guarantee.number || "—")} ${loan.guarantee.bank ? "نزد " + escapeHtml(loan.guarantee.bank) : ""} <b>عودت گردد</b>.</p>
        <p>این نامه پس از ثبت آخرین واریز در سامانه صندوق صادر شده و به منزله مفاصاحساب اقساط است.</p>
        <div class="sign-row">
          <div>مسئول صندوق<br/>امضا و مهر</div>
          <div>مدیر حسابداری<br/>تایید عودت ${g}</div>
        </div>
      </article>
    `;
  }

  /* ---- backup ---- */
  document.getElementById("btn-backup").onclick = () => {
    const blob = new Blob([JSON.stringify(state.loans)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qarz-backup.json";
    a.click();
  };
  document.getElementById("btn-restore").onclick = () => document.getElementById("restore-file").click();
  document.getElementById("restore-file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("bad");
      state.loans = data;
      save();
      toast("بازیابی شد");
      route();
    } catch {
      toast("فایل پشتیبان نامعتبر است");
    }
  };

  route();
})();
