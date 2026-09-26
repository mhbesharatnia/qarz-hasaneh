(() => {
  const KEY = "qarz-fund-v1";
  const ARVAN_KEY = "qarz-arvan-v1";
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
    loans: [],
    rev: 0,
    deletedIds: [],
    lastSeenRev: 0,
    draft: null,
    step: 0,
    editId: null,
  };

  function loadStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw) return;
      if (Array.isArray(raw)) {
        state.loans = raw;
        return;
      }
      state.loans = raw.loans || [];
      state.rev = Number(raw.rev) || 0;
      state.deletedIds = raw.deletedIds || [];
      state.lastSeenRev = state.rev;
    } catch {
      /* empty */
    }
  }

  function persistLocal() {
    localStorage.setItem(
      KEY,
      JSON.stringify({ loans: state.loans, rev: state.rev, deletedIds: state.deletedIds })
    );
  }

  function touchLoan(loan) {
    if (loan) loan.updatedAt = new Date().toISOString();
  }

  function save() {
    state.rev += 1;
    persistLocal();
    queueArvanPush();
  }

  loadStore();

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

  const JMONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return { y, m, d };
  }

  function jalaliLeap(jy) {
    const g = j2g(jy, 12, 30);
    const back = g2j(g.gy, g.gm, g.gd);
    return back.jy === jy && back.jm === 12 && back.jd === 30;
  }

  function jalaliMonthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return jalaliLeap(jy) ? 30 : 29;
  }

  function jalaliToIso(jy, jm, jd) {
    const g = j2g(Number(jy), Number(jm), Number(jd));
    return `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
  }

  function isoToParts(iso) {
    if (!iso) return null;
    const { y, m, d } = parseISO(iso.slice(0, 10));
    return g2j(y, m, d);
  }

  function todayParts() {
    const t = new Date();
    return g2j(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  function isoToJalali(iso) {
    if (!iso) return "—";
    const j = isoToParts(iso);
    if (!j) return "—";
    return faDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`);
  }

  function todayISO() {
    const t = new Date();
    return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
  }

  function nowTime() {
    const t = new Date();
    return `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
  }

  function addJalaliMonths(iso, n) {
    const { y, m, d } = parseISO(iso);
    const j = g2j(y, m, d);
    let jm = j.jm - 1 + n;
    let jy = j.jy + Math.floor(jm / 12);
    jm = ((jm % 12) + 12) % 12;
    const jd = Math.min(j.jd, jalaliMonthLength(jy, jm + 1));
    return jalaliToIso(jy, jm + 1, jd);
  }

  function daysBetween(a, b) {
    const da = new Date(a + "T00:00:00");
    const db = new Date(b + "T00:00:00");
    return Math.floor((db - da) / 86400000);
  }

  function formatPayAt(at) {
    if (!at) return "—";
    const [date, time] = at.split("T");
    const clock = (time || "").slice(0, 5);
    return isoToJalali(date) + (clock ? "، ساعت " + faDigits(clock) : "");
  }

  function feeOf(amount, percent) {
    return Math.round(Number(amount || 0) * (Number(percent) || 0) / 100);
  }

  function jdateSelects(iso, attrs) {
    const label = iso ? isoToJalali(iso) : "— / — / —";
    return `<div class="jdate" ${attrs} data-iso="${iso || ""}">
      <button type="button" class="jdate-btn" data-jopen>
        <span class="jdate-val">${label}</span>
        <span class="jdate-hint">تقویم شمسی</span>
      </button>
      <div class="jcal"></div>
    </div>`;
  }

  function readJdate(el) {
    return (el && el.dataset.iso) || "";
  }

  function weekdayIran(jy, jm, jd) {
    const g = j2g(jy, jm, jd);
    return (new Date(g.gy, g.gm - 1, g.gd).getDay() + 1) % 7;
  }

  function closeAllJdates() {
    document.querySelectorAll(".jdate.open").forEach((el) => el.classList.remove("open"));
  }

  function paintJcal(wrap) {
    const cal = wrap.querySelector(".jcal");
    const sel = wrap.dataset.iso ? isoToParts(wrap.dataset.iso) : null;
    const now = todayParts();
    const jy = wrap._jy || (sel ? sel.jy : now.jy);
    const jm = wrap._jm || (sel ? sel.jm : now.jm);
    wrap._jy = jy;
    wrap._jm = jm;
    const dim = jalaliMonthLength(jy, jm);
    const start = weekdayIran(jy, jm, 1);
    const JDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
    const yearFrom = now.jy - 100;
    const yearTo = now.jy + 10;
    let years = "";
    for (let y = yearTo; y >= yearFrom; y--) {
      years += `<option value="${y}" ${y === jy ? "selected" : ""}>${faDigits(y)}</option>`;
    }
    const months = JMONTHS.map(
      (name, i) => `<option value="${i + 1}" ${i + 1 === jm ? "selected" : ""}>${name}</option>`
    ).join("");
    let days = "";
    for (let i = 0; i < start; i++) days += `<button type="button" class="mute" disabled></button>`;
    for (let d = 1; d <= dim; d++) {
      const on = sel && sel.jy === jy && sel.jm === jm && sel.jd === d ? "on" : "";
      days += `<button type="button" data-jd="${d}" class="${on}">${faDigits(d)}</button>`;
    }
    cal.innerHTML = `
      <div class="jcal-head">
        <button type="button" class="jcal-nav" data-jnav="-1" title="ماه قبل">‹</button>
        <div class="jcal-pickers">
          <select class="jcal-month" data-jmonth aria-label="ماه">${months}</select>
          <select class="jcal-year" data-jyear aria-label="سال">${years}</select>
        </div>
        <button type="button" class="jcal-nav" data-jnav="1" title="ماه بعد">›</button>
      </div>
      <div class="jcal-week">${JDAYS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="jcal-days">${days}</div>
      <div class="jcal-foot">
        <button type="button" class="btn btn-sm btn-ghost" data-jtoday>امروز</button>
        <button type="button" class="btn btn-sm btn-ghost" data-jclear>پاک کردن</button>
      </div>
    `;
  }

  function applyJdate(wrap, iso, onChange) {
    wrap.dataset.iso = iso || "";
    wrap.querySelector(".jdate-val").textContent = iso ? isoToJalali(iso) : "— / — / —";
    wrap.classList.remove("open");
    onChange(wrap, iso || "");
  }

  function bindJdates(root, onChange) {
    root.querySelectorAll(".jdate").forEach((wrap) => {
      wrap.querySelector("[data-jopen]").onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasOpen = wrap.classList.contains("open");
        closeAllJdates();
        if (wasOpen) return;
        const cur = wrap.dataset.iso ? isoToParts(wrap.dataset.iso) : todayParts();
        wrap._jy = cur.jy;
        wrap._jm = cur.jm;
        paintJcal(wrap);
        wrap.classList.add("open");
      };
      const cal = wrap.querySelector(".jcal");
      cal.onchange = (e) => {
        e.stopPropagation();
        if (e.target.matches("[data-jyear]")) {
          wrap._jy = Number(e.target.value);
          paintJcal(wrap);
          return;
        }
        if (e.target.matches("[data-jmonth]")) {
          wrap._jm = Number(e.target.value);
          paintJcal(wrap);
        }
      };
      cal.onclick = (e) => {
        e.stopPropagation();
        if (e.target.closest("select")) return;
        const nav = e.target.closest("[data-jnav]");
        if (nav) {
          let m = wrap._jm + Number(nav.dataset.jnav);
          let y = wrap._jy;
          if (m > 12) {
            m = 1;
            y++;
          }
          if (m < 1) {
            m = 12;
            y--;
          }
          wrap._jy = y;
          wrap._jm = m;
          paintJcal(wrap);
          return;
        }
        if (e.target.closest("[data-jtoday]")) {
          applyJdate(wrap, todayISO(), onChange);
          return;
        }
        if (e.target.closest("[data-jclear]")) {
          applyJdate(wrap, "", onChange);
          return;
        }
        const dayBtn = e.target.closest("[data-jd]");
        if (dayBtn) applyJdate(wrap, jalaliToIso(wrap._jy, wrap._jm, Number(dayBtn.dataset.jd)), onChange);
      };
    });
  }

  function buildInstallments(amount, months, startDate) {
    const base = Math.floor(amount / months);
    const rem = amount - base * months;
    const rows = [];
    for (let i = 0; i < months; i++) {
      rows.push({
        n: i + 1,
        dueDate: addJalaliMonths(startDate, i),
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
    const rec = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res({ name: file.name, type: file.type, data: r.result, size: file.size });
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const cfg = arvanCfg();
    if (arvanReady(cfg)) {
      try {
        const key = `${cfg.prefix.replace(/\/$/, "")}/files/${Date.now()}-${safeName(file.name)}`;
        rec.arvanKey = await arvanPut(cfg, key, dataUrlToBlob(rec.data), rec.type || "application/octet-stream");
        delete rec.data;
      } catch (err) {
        toast("آپلود به آروان ناموفق بود: " + explainArvanError(err));
      }
    }
    return rec;
  }

  function kv(label, value) {
    const v = value == null || String(value).trim() === "" ? "—" : String(value);
    return `<div class="kv"><span>${escapeHtml(label)}</span><b>${v}</b></div>`;
  }

  function filePreview(file, label) {
    const title = label || (file && file.name) || "فایل";
    const cap = `<span class="file-label">${escapeHtml(title)}</span>`;
    if (!file) {
      return `<div class="doc-slot">${cap}<div class="file-chip">ثبت نشده</div></div>`;
    }
    if (file.type && file.type.startsWith("image/") && file.data) {
      return `<div class="doc-slot">${cap}<img class="zoomable" src="${file.data}" alt="${escapeHtml(title)}" data-zoom-src="${file.data}" data-zoom-title="${escapeHtml(title)}" /></div>`;
    }
    if (file.arvanKey) {
      const kind = file.type && file.type.startsWith("image/") ? "image" : "file";
      return `<div class="doc-slot">${cap}<span class="file-chip arvan-preview" data-arvan-key="${escapeHtml(file.arvanKey)}" data-arvan-name="${escapeHtml(file.name || title)}" data-arvan-kind="${kind}" data-zoom-title="${escapeHtml(title)}">در حال دریافت…</span></div>`;
    }
    if (file.data) {
      return `<div class="doc-slot">${cap}<span class="file-chip file-open" data-open-src="${file.data}">${escapeHtml(file.name || title)} — باز کردن</span></div>`;
    }
    return `<div class="doc-slot">${cap}<div class="file-chip">${escapeHtml(file.name)}</div></div>`;
  }

  /* ---- routing ---- */
  function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const parts = hash.split("/").filter(Boolean);
    if (parts[0] === "settings") renderSettings();
    else if (parts[0] === "new") {
      if (state.editId) {
        state.editId = null;
        state.draft = null;
        state.step = 0;
      }
      renderNew();
    } else if (parts[0] === "edit" && parts[1]) startEdit(parts[1]);
    else if (parts[0] === "loan" && parts[1]) renderLoan(parts[1]);
    else if (parts[0] === "letter" && parts[1]) renderLetter(parts[1]);
    else renderHome();
    refreshSyncPill();
    hydrateArvanPreviews(view);
  }

  function refreshIfIdle() {
    if (state.draft) return;
    if (modalEl.classList.contains("show")) return;
    route();
  }

  /* ---- Arvan Object Storage (private, signed) ---- */
  const SHARE_KIND = "qarz-arvan-share";
  const blobUrlCache = {};

  function arvanDefaults() {
    return {
      enabled: false,
      endpoint: "https://s3.ir-thr-at1.arvanstorage.ir",
      region: "ir-thr-at1",
      bucket: "",
      accessKey: "",
      secretKey: "",
      prefix: "qarz-fund",
    };
  }

  function normalizeEndpoint(raw) {
    let s = String(raw || "")
      .trim()
      .replace(/^[\u200e\u200f]+|[\u200e\u200f]+$/g, "")
      .replace(/\/+$/, "");
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.origin;
    } catch {
      return "";
    }
  }

  function arvanCfg() {
    try {
      const cfg = { ...arvanDefaults(), ...JSON.parse(localStorage.getItem(ARVAN_KEY) || "{}") };
      cfg.endpoint = normalizeEndpoint(cfg.endpoint) || arvanDefaults().endpoint;
      cfg.region = String(cfg.region || "ir-thr-at1").trim() || "ir-thr-at1";
      cfg.bucket = String(cfg.bucket || "").trim();
      cfg.prefix = String(cfg.prefix || "qarz-fund").trim() || "qarz-fund";
      return cfg;
    } catch {
      return arvanDefaults();
    }
  }

  function arvanReady(cfg = arvanCfg()) {
    return !!(cfg.enabled && normalizeEndpoint(cfg.endpoint) && cfg.bucket && cfg.accessKey && cfg.secretKey);
  }

  function dataKey(cfg = arvanCfg()) {
    return `${(cfg.prefix || "qarz-fund").replace(/\/$/, "")}/shared/state.json`;
  }

  function safeName(name) {
    return String(name || "file").replace(/[^\w.\-()\u0600-\u06FF]+/g, "_").slice(0, 80);
  }

  function dataUrlToBlob(dataUrl) {
    const [head, body] = String(dataUrl).split(",");
    const mime = (head.match(/:(.*?);/) || [])[1] || "application/octet-stream";
    const bin = atob(body || "");
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function stripFileData(loans) {
    const clone = JSON.parse(JSON.stringify(loans));
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (node.arvanKey && node.data) delete node.data;
      Object.values(node).forEach(walk);
    };
    walk(clone);
    return clone;
  }

  function mergeStores(localLoans, remoteLoans, deletedIds) {
    const gone = new Set(deletedIds || []);
    const map = new Map();
    [...(remoteLoans || []), ...(localLoans || [])].forEach((loan) => {
      if (!loan || !loan.id || gone.has(loan.id)) return;
      const prev = map.get(loan.id);
      if (!prev || (loan.updatedAt || "") >= (prev.updatedAt || "")) map.set(loan.id, loan);
    });
    return [...map.values()];
  }

  async function sha256Hex(data) {
    const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function hmacSha256(key, data) {
    const rawKey = typeof key === "string" ? new TextEncoder().encode(key) : key;
    const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const payload = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, payload));
  }

  async function awsSigningKey(secret, dateStamp, region, service) {
    const kDate = await hmacSha256("AWS4" + secret, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    return hmacSha256(kService, "aws4_request");
  }

  function toHex(bytes) {
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function amzNow() {
    const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    return { amzDate: iso, dateStamp: iso.slice(0, 8) };
  }

  async function arvanRequest(cfg, method, key, blob, contentType) {
    const endpoint = normalizeEndpoint(cfg.endpoint);
    if (!endpoint) {
      throw new Error("آدرس Endpoint نامعتبر است. باید شبیه https://s3.ir-thr-at1.arvanstorage.ir باشد");
    }
    const host = new URL(endpoint).host;
    const path = `/${cfg.bucket}/${String(key).split("/").filter(Boolean).map(encodeURIComponent).join("/")}`;
    const url = endpoint + path;
    const { amzDate, dateStamp } = amzNow();
    const isPut = method === "PUT";
    const buf = isPut ? await blob.arrayBuffer() : null;
    const payloadHash = isPut ? await sha256Hex(buf) : await sha256Hex("");
    const ctype = isPut ? contentType || blob.type || "application/octet-stream" : "";
    const headerMap = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
    if (isPut) headerMap["content-type"] = ctype;
    const signedHeaders = Object.keys(headerMap).sort().join(";");
    const canonicalHeaders = Object.keys(headerMap)
      .sort()
      .map((k) => `${k}:${headerMap[k]}\n`)
      .join("");
    const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
    const sig = toHex(await hmacSha256(await awsSigningKey(cfg.secretKey, dateStamp, cfg.region, "s3"), stringToSign));
    const headers = {
      Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (isPut) headers["Content-Type"] = ctype;
    try {
      return await fetch(url, { method, headers, body: isPut ? buf : undefined });
    } catch (err) {
      throw new Error(explainArvanError(err));
    }
  }

  function explainArvanError(err) {
    const msg = String((err && err.message) || err || "");
    if (/Failed to fetch|NetworkError|ERR_FAILED|CORS|access control/i.test(msg)) {
      return "اتصال به آروان از مرورگر رد شد. Origin را با https و Allowed Header را با * در پنل آروان ذخیره کنید.";
    }
    return msg;
  }

  async function arvanPut(cfg, key, blob, contentType) {
    const res = await arvanRequest(cfg, "PUT", key, blob, contentType);
    if (!res.ok) throw new Error(`آروان ${res.status}: ${(await res.text()).slice(0, 180)}`);
    return key;
  }

  async function arvanGet(cfg, key) {
    const res = await arvanRequest(cfg, "GET", key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`آروان ${res.status}: ${(await res.text()).slice(0, 180)}`);
    return res;
  }

  function refreshSyncPill() {
    const pill = document.getElementById("sync-pill");
    const btn = document.getElementById("btn-sync");
    const on = arvanReady();
    if (pill) {
      pill.hidden = !on;
      pill.textContent = on ? "همگام با آروان (خصوصی)" : "";
    }
    if (btn) btn.hidden = !on;
  }

  async function hydrateArvanPreviews(root = document) {
    if (!arvanReady()) return;
    const cfg = arvanCfg();
    const nodes = [...root.querySelectorAll("[data-arvan-key]")];
    await Promise.all(
      nodes.map(async (el) => {
        const key = el.dataset.arvanKey;
        if (!key) return;
        try {
          if (!blobUrlCache[key]) {
            const res = await arvanGet(cfg, key);
            if (!res) return;
            blobUrlCache[key] = URL.createObjectURL(await res.blob());
          }
          if (el.dataset.arvanKind === "image" || el.tagName === "IMG") {
            const img = document.createElement("img");
            img.className = "zoomable";
            img.src = blobUrlCache[key];
            img.alt = el.dataset.zoomTitle || el.dataset.arvanName || "";
            img.dataset.zoomSrc = blobUrlCache[key];
            img.dataset.zoomTitle = el.dataset.zoomTitle || el.dataset.arvanName || "";
            el.replaceWith(img);
          } else {
            el.textContent = (el.dataset.arvanName || "فایل") + " — باز کردن";
            el.classList.add("file-open");
            el.dataset.openSrc = blobUrlCache[key];
          }
        } catch {
          el.textContent = "دریافت فایل ناموفق";
        }
      })
    );
  }

  let arvanPushTimer = 0;
  let arvanPullTimer = 0;
  let arvanBusy = false;

  function queueArvanPush() {
    const cfg = arvanCfg();
    if (!arvanReady(cfg)) return;
    clearTimeout(arvanPushTimer);
    arvanPushTimer = setTimeout(() => {
      pushSharedState(cfg).catch((err) => toast("همگام‌سازی آروان: " + explainArvanError(err)));
    }, 600);
  }

  async function waitArvanIdle() {
    for (let i = 0; i < 40 && arvanBusy; i++) await new Promise((r) => setTimeout(r, 80));
  }

  async function pullSharedState(cfg = arvanCfg(), { silent } = {}) {
    if (!arvanReady(cfg)) return false;
    await waitArvanIdle();
    if (arvanBusy) return false;
    arvanBusy = true;
    try {
      const res = await arvanGet(cfg, dataKey(cfg));
      if (!res) return false;
      const remote = JSON.parse(await res.text());
      if (!remote || !Array.isArray(remote.loans)) return false;
      const remoteRev = Number(remote.rev) || 0;
      if (remoteRev <= state.lastSeenRev && remoteRev <= state.rev) return false;
      state.deletedIds = [...new Set([...(state.deletedIds || []), ...(remote.deletedIds || [])])];
      state.loans = mergeStores(state.loans, remote.loans, state.deletedIds);
      state.rev = Math.max(state.rev, remoteRev);
      state.lastSeenRev = remoteRev;
      persistLocal();
      if (!silent) toast("تغییرات مشترک از آروان آمد");
      return true;
    } finally {
      arvanBusy = false;
    }
  }

  async function pushSharedState(cfg = arvanCfg()) {
    if (!arvanReady(cfg)) throw new Error("اتصال آروان کامل نیست");
    await waitArvanIdle();
    await pullSharedState(cfg, { silent: true });
    await waitArvanIdle();
    arvanBusy = true;
    try {
      const payload = {
        kind: "qarz-shared-state",
        rev: state.rev,
        updatedAt: new Date().toISOString(),
        deletedIds: state.deletedIds || [],
        loans: stripFileData(state.loans),
      };
      await arvanPut(cfg, dataKey(cfg), new Blob([JSON.stringify(payload)], { type: "application/json" }), "application/json");
      state.lastSeenRev = state.rev;
      persistLocal();
    } finally {
      arvanBusy = false;
    }
  }

  function startArvanLoop() {
    clearInterval(arvanPullTimer);
    refreshSyncPill();
    if (!arvanReady()) return;
    pullSharedState(arvanCfg(), { silent: true })
      .then((changed) => {
        if (changed) refreshIfIdle();
      })
      .catch(() => {});
    arvanPullTimer = setInterval(async () => {
      try {
        const changed = await pullSharedState(arvanCfg(), { silent: true });
        if (changed) refreshIfIdle();
      } catch {
        /* keep polling */
      }
    }, 12000);
  }

  function readSettingsForm() {
    return {
      enabled: document.getElementById("a-on").checked,
      endpoint: normalizeEndpoint(document.getElementById("a-ep").value) || document.getElementById("a-ep").value.trim(),
      region: document.getElementById("a-rg").value.trim() || "ir-thr-at1",
      bucket: document.getElementById("a-bk").value.trim(),
      prefix: document.getElementById("a-px").value.trim() || "qarz-fund",
      accessKey: document.getElementById("a-ak").value.trim(),
      secretKey: document.getElementById("a-sk").value,
    };
  }

  function exportShareFile(cfg = arvanCfg()) {
    if (!cfg.accessKey || !cfg.secretKey || !cfg.bucket) return toast("اول اتصال را ذخیره کنید");
    const share = {
      kind: SHARE_KIND,
      v: 1,
      endpoint: cfg.endpoint,
      region: cfg.region,
      bucket: cfg.bucket,
      prefix: cfg.prefix,
      accessKey: cfg.accessKey,
      secretKey: cfg.secretKey,
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(share, null, 2)], { type: "application/json" }));
    a.download = "qarz-arvan-share.json";
    a.click();
    toast("فایل اتصال آماده است؛ فقط به همکارتان بدهید");
  }

  async function importShareFile(file) {
    const data = JSON.parse(await file.text());
    if (data.kind !== SHARE_KIND || !data.accessKey || !data.bucket) throw new Error("bad");
    const next = {
      ...arvanDefaults(),
      enabled: true,
      endpoint: data.endpoint || arvanDefaults().endpoint,
      region: data.region || "ir-thr-at1",
      bucket: data.bucket,
      prefix: data.prefix || "qarz-fund",
      accessKey: data.accessKey,
      secretKey: data.secretKey,
    };
    localStorage.setItem(ARVAN_KEY, JSON.stringify(next));
    toast("به صندوق مشترک وصل شدید");
    startArvanLoop();
    try {
      const changed = await pullSharedState(next);
      if (!changed && state.loans.length) await pushSharedState(next);
    } catch (err) {
      toast(explainArvanError(err));
    }
    route();
  }

  function renderSettings() {
    const c = arvanCfg();
    view.innerHTML = `
      <div class="card">
        <h2 class="section-title">اتصال مشترک به آروان</h2>
        <p>باکت را <b>خصوصی</b> بگذارید. فایل‌ها و پرونده‌ها فقط با کلید امضاشده خوانده می‌شوند؛ لینک عمومی لازم نیست.</p>
        <p class="hint">بعد از وصل شدن، «خروجی اتصال» بگیرید و همان فایل را به همکارتان بدهید تا هر دو به یک صندوق وصل شوید و تغییرات همدیگر را ببینید.</p>
        <div class="field" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="a-on" ${c.enabled ? "checked" : ""} />
          <label for="a-on" style="margin:0">این مرورگر به صندوق مشترک وصل باشد</label>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>Endpoint</label><input id="a-ep" value="${escapeHtml(c.endpoint)}" /></div>
          <div class="field"><label>Region</label><input id="a-rg" value="${escapeHtml(c.region)}" /></div>
          <div class="field"><label>نام باکت</label><input id="a-bk" value="${escapeHtml(c.bucket)}" /></div>
          <div class="field"><label>پوشه (prefix)</label><input id="a-px" value="${escapeHtml(c.prefix)}" /></div>
          <div class="field"><label>Access Key</label><input id="a-ak" value="${escapeHtml(c.accessKey)}" autocomplete="off" /></div>
          <div class="field"><label>Secret Key</label><input id="a-sk" type="password" value="${escapeHtml(c.secretKey)}" autocomplete="off" /></div>
        </div>
        <p class="hint">Endpoint نمونه: <code>https://s3.ir-thr-at1.arvanstorage.ir</code></p>
        <div class="actions">
          <button class="btn btn-primary" id="a-save">ذخیره و همگام‌سازی</button>
          <button class="btn btn-gold" id="a-export">خروجی اتصال برای همکار</button>
          <button class="btn btn-ghost" id="a-import">ورود فایل اتصال</button>
          <input type="file" id="a-import-file" accept="application/json" hidden />
          <a class="btn btn-ghost" href="#/">بازگشت</a>
        </div>
        <p class="hint" id="a-status">${arvanReady(c) ? "وصل هستید. هر ۱۲ ثانیه تغییرات همکار خوانده می‌شود." : "هنوز وصل نیست."}</p>
      </div>
    `;
    document.getElementById("a-save").onclick = async () => {
      const next = readSettingsForm();
      if (!normalizeEndpoint(next.endpoint)) {
        toast("Endpoint نامعتبر است. مثال: https://s3.ir-thr-at1.arvanstorage.ir");
        return;
      }
      next.endpoint = normalizeEndpoint(next.endpoint);
      localStorage.setItem(ARVAN_KEY, JSON.stringify(next));
      toast("تنظیمات ذخیره شد");
      startArvanLoop();
      try {
        if (arvanReady(next)) {
          const changed = await pullSharedState(next);
          if (!changed && state.loans.length) await pushSharedState(next);
          document.getElementById("a-status").textContent = "وصل شدید. خروجی اتصال را به همکارتان بدهید.";
        }
      } catch (err) {
        toast(explainArvanError(err));
      }
      refreshSyncPill();
    };
    document.getElementById("a-export").onclick = () => {
      const next = readSettingsForm();
      localStorage.setItem(ARVAN_KEY, JSON.stringify(next));
      exportShareFile(next);
    };
    document.getElementById("a-import").onclick = () => document.getElementById("a-import-file").click();
    document.getElementById("a-import-file").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        await importShareFile(f);
      } catch {
        toast("فایل اتصال نامعتبر است");
      }
    };
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
                      <div class="hint">مبلغ ${toFa(l.amount)} تومان · کارمزد ${toFa(l.feePercent || 0)}٪ · ${faDigits(l.months)} قسط · ضمانت: ${l.guarantee.type === "check" ? "چک" : "سفته"}</div>
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
      feePercent: "0",
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
        <div class="field"><label>تاریخ تولد</label>${jdateSelects(p.birthDate, `data-p="${prefix}" data-k="birthDate"`)}</div>
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
      if (el.classList.contains("jdate")) return;
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
      if (el.classList.contains("jdate")) return;
      el.oninput = () => {
        state.draft[el.dataset.loan] = el.value;
        if (el.dataset.loan === "amount" || el.dataset.loan === "months" || el.dataset.loan === "feePercent") {
          refreshPreview();
        }
      };
    });
    bindJdates(root, (el, iso) => {
      if (el.dataset.p && el.dataset.k) state.draft[el.dataset.p][el.dataset.k] = iso;
      if (el.dataset.loan) {
        state.draft[el.dataset.loan] = iso;
        if (el.dataset.loan === "firstDue") refreshPreview();
      }
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
    const feePercent = Number(state.draft.feePercent) || 0;
    const fee = feeOf(amount, feePercent);
    if (!amount || !months || months < 1) return `<p class="hint">مبلغ وام و تعداد ماه را وارد کنید تا جدول اقساط ساخته شود.</p>`;
    const rows = buildInstallments(amount, months, state.draft.firstDue || todayISO());
    return `
    <div class="alert alert-gold">
      <p>کارمزد ${toFa(feePercent)}٪ = ${toFa(fee)} تومان ${feePercent ? "· این مبلغ جدا از اقساط اصل وام است" : "· پیش‌فرض صفر است"}</p>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>قسط</th><th>سررسید شمسی</th><th>مبلغ (تومان)</th></tr></thead>
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
    downloadExcel(fullName(state.draft.recipient) || "وام", amount, months, rows, false, state.draft.feePercent);
  }

  function downloadExcel(name, amount, months, rows, paymentsMap, feePercent) {
    if (!window.XLSX) return toast("کتابخانه اکسل بارگذاری نشد");
    const fee = feeOf(amount, feePercent);
    const data = [
      ["صندوق قرض‌الحسنه — جدول اقساط"],
      ["دریافت‌کننده", name],
      ["مبلغ وام (تومان)", amount],
      ["کارمزد (درصد)", Number(feePercent) || 0],
      ["مبلغ کارمزد (تومان)", fee],
      ["تعداد اقساط", months],
      [],
      ["شماره قسط", "تاریخ سررسید شمسی", "مبلغ قسط", "پرداخت‌شده", "مانده", "وضعیت"],
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
    const editing = !!state.editId;
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
        <div class="grid grid-2">
          <div class="field"><label>مبلغ وام (تومان)</label><input type="number" min="1" data-loan="amount" value="${escapeHtml(d.amount)}" /></div>
          <div class="field"><label>تعداد ماه بازپرداخت</label><input type="number" min="1" data-loan="months" value="${escapeHtml(d.months)}" /></div>
          <div class="field"><label>کارمزد (درصد)</label><input type="number" min="0" step="0.1" data-loan="feePercent" value="${escapeHtml(d.feePercent)}" /></div>
          <div class="field"><label>تاریخ سررسید قسط اول (شمسی)</label>${jdateSelects(d.firstDue, `data-loan="firstDue"`)}</div>
        </div>
        <p class="hint">تاریخ‌ها شمسی است. با تعیین مبلغ و تعداد ماه، سررسید هر قسط ماه‌به‌ماه شمسی محاسبه می‌شود. کارمزد پیش‌فرض صفر است و جدا از اصل اقساط نمایش داده می‌شود.${editing ? " در ویرایش، اگر مبلغ یا تعداد ماه یا سررسید اول عوض شود جدول اقساط از نو ساخته می‌شود و واریزهای قبلی روی همان شماره قسط حفظ می‌مانند." : ""}</p>
        <div id="inst-preview">${previewTable()}</div>
      `;
    }

    const cancelHref = editing ? `#/loan/${state.editId}` : "#/";
    const submitLabel = s < STEPS.length - 1 ? "ادامه" : editing ? "ذخیره تغییرات" : "ثبت پرونده";

    view.innerHTML = `
      <div class="stepper">${STEPS.map((t, i) => `<div class="step ${i === s ? "on" : ""}">${faDigits(i + 1)}. ${t}</div>`).join("")}</div>
      ${editing ? `<div class="alert alert-gold"><p>در حال ویرایش پرونده — پس از ذخیره به همان پرونده برمی‌گردید.</p></div>` : ""}
      <form class="card" id="loan-form">${body}
        <div class="actions">
          ${s > 0 ? `<button type="button" class="btn btn-ghost" id="prev">قبلی</button>` : ""}
          <button type="submit" class="btn btn-primary">${submitLabel}</button>
          <a class="btn btn-ghost" href="${cancelHref}">انصراف</a>
        </div>
      </form>
    `;
    bindDraft(view);
    hydrateArvanPreviews(view);
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

  function cloneDeep(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function startEdit(id) {
    const loan = state.loans.find((l) => l.id === id);
    if (!loan) {
      view.innerHTML = `<div class="card empty">پرونده پیدا نشد. <a href="#/">بازگشت</a></div>`;
      return;
    }
    if (state.editId !== id || !state.draft) {
      state.editId = id;
      state.step = 0;
      state.draft = {
        recipient: { ...emptyPerson(), ...loan.recipient },
        introducer: { ...emptyPerson(), ...loan.introducer },
        guarantor: { ...emptyPerson(), ...loan.guarantor },
        docs: cloneDeep(loan.docs || { recipient: emptyDocs(), introducer: emptyDocs(), guarantor: emptyDocs() }),
        guarantee: { type: "check", received: false, number: "", bank: "", note: "", ...(loan.guarantee || {}) },
        amount: String(loan.amount ?? ""),
        months: String(loan.months ?? ""),
        feePercent: String(loan.feePercent ?? 0),
        firstDue: loan.firstDue || todayISO(),
      };
    }
    renderNew();
  }

  function mergeInstallments(prevInst, nextInst) {
    const byN = new Map((prevInst || []).map((i) => [i.n, i]));
    return nextInst.map((row) => {
      const old = byN.get(row.n);
      return old && old.payments && old.payments.length ? { ...row, payments: cloneDeep(old.payments) } : row;
    });
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
    const feePercent = Number(d.feePercent) || 0;
    const editId = state.editId;

    if (editId) {
      const idx = state.loans.findIndex((l) => l.id === editId);
      if (idx < 0) {
        toast("پرونده پیدا نشد");
        return;
      }
      const prev = state.loans[idx];
      const scheduleChanged =
        Number(prev.amount) !== amount ||
        Number(prev.months) !== months ||
        (prev.firstDue || "") !== (d.firstDue || "");
      const installments = scheduleChanged
        ? mergeInstallments(prev.installments, buildInstallments(amount, months, d.firstDue))
        : prev.installments;
      const loan = {
        ...prev,
        recipient: { ...d.recipient },
        introducer: { ...d.introducer },
        guarantor: { ...d.guarantor },
        docs: d.docs,
        guarantee: { ...d.guarantee },
        amount,
        feePercent,
        feeAmount: feeOf(amount, feePercent),
        months,
        firstDue: d.firstDue,
        installments,
      };
      touchLoan(loan);
      state.loans[idx] = loan;
      save();
      state.draft = null;
      state.step = 0;
      state.editId = null;
      toast("تغییرات ذخیره شد");
      location.hash = "#/loan/" + loan.id;
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
      feePercent,
      feeAmount: feeOf(amount, feePercent),
      months,
      firstDue: d.firstDue,
      installments: buildInstallments(amount, months, d.firstDue),
    };
    touchLoan(loan);
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
      <div class="grid grid-2">
        ${kv("عنوان", titleOf(p))}
        ${kv("نام", p.firstName)}
        ${kv("نام خانوادگی", p.lastName)}
        ${kv("نام پدر", p.fatherName)}
        ${kv("جنسیت", p.gender === "female" ? "خانم" : "آقا")}
        ${kv("کد ملی", faDigits(p.nationalId || ""))}
        ${kv("تاریخ تولد", isoToJalali(p.birthDate))}
        ${kv("موبایل", faDigits(p.mobile || ""))}
        ${kv("تلفن ثابت", faDigits(p.phone || ""))}
        ${kv("شغل", p.job)}
        ${kv("محل کار", p.workplace)}
      </div>
      ${kv("نشانی", p.address)}
      <h4 class="docs-title">مدارک ${title}</h4>
      <div class="preview">
        ${filePreview(docs.nationalCard, "کارت ملی")}
        ${filePreview(docs.identityBook, "شناسنامه")}
        ${filePreview(docs.extra, optionalDocs ? "سایر مدارک (اختیاری)" : "سایر مدارک")}
      </div>
    </div>`;
  }

  function renderLoan(id) {
    if (state.editId) {
      state.editId = null;
      state.draft = null;
      state.step = 0;
    }
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
          <a class="btn btn-primary" href="#/edit/${loan.id}">ویرایش پرونده</a>
          <button class="btn btn-gold" id="excel-loan">خروجی اکسل اقساط</button>
          ${settled ? `<a class="btn btn-primary" href="#/letter/${loan.id}">نامه تسویه</a>` : ""}
          <button class="btn btn-danger" id="del-loan">حذف پرونده</button>
        </div>
        <div class="grid grid-4" style="margin:16px 0">
          <div class="stat"><span>مبلغ وام</span><b>${toFa(loan.amount)} تومان</b></div>
          <div class="stat"><span>درصد کارمزد</span><b>${toFa(loan.feePercent || 0)}٪</b></div>
          <div class="stat"><span>مبلغ کارمزد</span><b>${toFa(loan.feeAmount || feeOf(loan.amount, loan.feePercent))} تومان</b></div>
          <div class="stat"><span>تعداد اقساط</span><b>${toFa(loan.months)} ماه</b></div>
        </div>
        <div class="grid grid-2" style="margin:0 0 16px">
          ${kv("تاریخ سررسید قسط اول", isoToJalali(loan.firstDue))}
          ${kv("تاریخ ثبت پرونده", isoToJalali((loan.createdAt || "").slice(0, 10)))}
        </div>
        <div class="grid grid-3">
          ${personCard("دریافت‌کننده", loan.recipient, loan.docs.recipient)}
          ${personCard("معرف", loan.introducer, loan.docs.introducer, true)}
          ${personCard("ضامن", loan.guarantor, loan.docs.guarantor)}
        </div>
        <div class="card" style="margin-top:16px">
          <h3 class="section-title">نامه‌ها و ضمانت</h3>
          <div class="grid grid-2">
            ${kv("نوع ضمانت", loan.guarantee.type === "check" ? "چک ضمانت" : "سفته ضمانت")}
            ${kv("وضعیت دریافت ضمانت", loan.guarantee.received ? "دریافت شد" : "دریافت نشده")}
            ${kv("شماره سند ضمانت", faDigits(loan.guarantee.number || ""))}
            ${kv("بانک / محل صدور", loan.guarantee.bank)}
          </div>
          ${kv("توضیحات ضمانت", loan.guarantee.note)}
          <h4 class="docs-title">اسکن نامه‌ها و سند ضمانت</h4>
          <div class="preview">
            ${filePreview(loan.docs.introducerLetter, "نامه معرف")}
            ${filePreview(loan.docs.guarantorLetter, "نامه تایید ضامن")}
            ${filePreview(loan.docs.guaranteeScan, "اسکن چک / سفته ضمانت")}
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
      downloadExcel(fullName(loan.recipient), loan.amount, loan.months, loan.installments, true, loan.feePercent);
    document.getElementById("del-loan").onclick = () => {
      if (!confirm("این پرونده حذف شود؟")) return;
      state.deletedIds = [...new Set([...(state.deletedIds || []), loan.id])];
      state.loans = state.loans.filter((x) => x.id !== loan.id);
      save();
      location.hash = "#/";
    };
    view.querySelectorAll("[data-pay]").forEach((btn) => {
      btn.onclick = () => openPay(loan.id, Number(btn.dataset.pay));
    });
    hydrateArvanPreviews(view);
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
            <td>${formatPayAt(p.at)}</td>
            <td>${escapeHtml(methodLabel(p.method))}</td>
            <td>${faDigits(p.tracking || "—")}</td>
            <td>${p.receipt ? filePreview(p.receipt, "رسید واریز") : "—"}</td>
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
      <div class="field"><label>تاریخ واریز (شمسی)</label>${jdateSelects(todayISO(), 'id="p-jdate"')}</div>
      <div class="field"><label>ساعت واریز</label><input type="time" id="p-time" value="${nowTime()}" /></div>
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
    bindJdates(modalEl, () => {});
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
      const payDate = readJdate(document.getElementById("p-jdate"));
      const payTime = document.getElementById("p-time").value || nowTime();
      inst.payments.push({
        amount,
        at: (payDate || todayISO()) + "T" + payTime,
        method: document.getElementById("p-method").value,
        tracking: document.getElementById("p-track").value.trim(),
        receipt,
        note: document.getElementById("p-note").value.trim(),
      });
      touchLoan(loan);
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
        <p>بدین‌وسیله تایید می‌گردد که ${escapeHtml(titleOf(loan.recipient))} فرزند ${escapeHtml(loan.recipient.fatherName || "—")} به شماره ملی ${faDigits(loan.recipient.nationalId || "—")} تمامی اقساط وام به مبلغ ${toFa(loan.amount)} تومان${loan.feePercent ? ` با کارمزد ${toFa(loan.feePercent)}٪ معادل ${toFa(loan.feeAmount || feeOf(loan.amount, loan.feePercent))} تومان` : ""} را در ${faDigits(loan.months)} قسط به‌طور کامل پرداخت و تسویه نموده است.</p>
        <p>با توجه به پایان تعهدات نام‌برده، به <b>مدیر حسابداری</b> اعلام می‌گردد که ${g} ایشان به شماره ${faDigits(loan.guarantee.number || "—")} ${loan.guarantee.bank ? "نزد " + escapeHtml(loan.guarantee.bank) : ""} <b>عودت گردد</b>.</p>
        <p>این نامه پس از ثبت آخرین واریز در سامانه صندوق صادر شده و به منزله مفاصاحساب اقساط است.</p>
        <div class="sign-row">
          <div>مسئول صندوق<br/>امضا و مهر</div>
          <div>مدیر حسابداری<br/>تایید عودت ${g}</div>
        </div>
      </article>
    `;
  }

  document.getElementById("btn-sync").onclick = async () => {
    if (!arvanReady()) return toast("اول از «اتصال مشترک» وصل شوید");
    try {
      const changed = await pullSharedState();
      toast(changed ? "تغییرات همکار آمد" : "همین الان همگام هستید");
      route();
    } catch (err) {
      toast(explainArvanError(err));
    }
  };

  function openLightbox(src, title) {
    const box = document.getElementById("lightbox");
    if (!box || !src) return;
    document.getElementById("lightbox-img").src = src;
    document.getElementById("lightbox-title").textContent = title || "";
    box.hidden = false;
  }

  function closeLightbox() {
    const box = document.getElementById("lightbox");
    if (!box) return;
    box.hidden = true;
    document.getElementById("lightbox-img").src = "";
  }

  document.getElementById("lightbox-close").onclick = closeLightbox;
  document.getElementById("lightbox").onclick = (e) => {
    if (e.target.id === "lightbox") closeLightbox();
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  document.addEventListener("click", (e) => {
    const openFile = e.target.closest("[data-open-src]");
    if (openFile) {
      e.preventDefault();
      window.open(openFile.dataset.openSrc, "_blank", "noopener");
      return;
    }
    const zoom = e.target.closest(".zoomable");
    if (zoom) {
      e.preventDefault();
      openLightbox(zoom.dataset.zoomSrc || zoom.src, zoom.dataset.zoomTitle || zoom.alt || "");
      return;
    }
    if (!e.target.closest(".jdate")) closeAllJdates();
  });

  startArvanLoop();
  route();
})();
