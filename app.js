/* ===================== Mes Sous — budget mensuel ===================== */

/* ---------- storage keys (v2) ---------- */
const TXN_KEY = "mesSous.transactions.v2";
const EXP_CAT_KEY = "mesSous.expenseCategories.v2";
const INC_CAT_KEY = "mesSous.incomeCategories.v2";
const LABEL_KEY = "mesSous.labels.v2";
const RECUR_KEY = "mesSous.recurring.v2";

/* legacy v1 keys (single-category expense tracker) — used for one-time migration */
const OLD_EXPENSES_KEY = "mesSous.expenses.v1";
const OLD_CATEGORIES_KEY = "mesSous.categories.v1";
const OLD_MERCHANTS_KEY = "mesSous.merchants.v1";

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: "alimentation", name: "Alimentation", emoji: "🍎", color: "#A9E4D0", default: true },
  { id: "transport", name: "Transport", emoji: "🚗", color: "#C9B6E8", default: true },
  { id: "logement", name: "Logement", emoji: "🏠", color: "#FFD1A9", default: true },
  { id: "loisirs", name: "Loisirs", emoji: "🎉", color: "#FF8FA3", default: true },
  { id: "sante", name: "Santé", emoji: "💊", color: "#9FD3F0", default: true },
  { id: "autres", name: "Autres", emoji: "✨", color: "#E4C1F9", default: true },
];

const DEFAULT_INCOME_CATEGORIES = [
  { id: "salaire", name: "Salaire", emoji: "💼", color: "#A9E4D0", default: true },
  { id: "depot-especes", name: "Dépôt d'espèces", emoji: "💵", color: "#FFD1A9", default: true },
  { id: "interets", name: "Intérêts", emoji: "📈", color: "#9FD3F0", default: true },
  { id: "remboursement", name: "Remboursement", emoji: "🧾", color: "#C9B6E8", default: true },
  { id: "autre-recette", name: "Autre recette", emoji: "✨", color: "#E4C1F9", default: true },
];

const CAT_COLORS = ["#A9E4D0", "#C9B6E8", "#FFD1A9", "#FF8FA3", "#9FD3F0", "#E4C1F9", "#FFE29A", "#B5EAD7"];

let transactions = [];   // { id, type: 'expense'|'income', date, categoryId, label, amount, createdAt, recurringId? }
let expenseCategories = [];
let incomeCategories = [];
let labels = [];
let recurring = [];      // { id, type, categoryId, label, amount, dayOfMonth, startDate, endDate, active }

let currentMode = "expense";     // for the Ajouter form
let currentSettingsCatType = "expense"; // for the Réglages category subtabs
let currentPage = "summary";     // active bottom-tab page
let currentMonth = "";           // "YYYY-MM"
let currentYear = 0;             // number
let summaryView = "month";       // "month" | "year" (only meaningful on the Résumé page)

/* ================= persistence ================= */

function loadAll() {
  const rawTxn = localStorage.getItem(TXN_KEY);
  if (rawTxn === null) {
    migrateFromV1();
  } else {
    transactions = safeParse(rawTxn, []);
    expenseCategories = safeParse(localStorage.getItem(EXP_CAT_KEY), JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)));
    incomeCategories = safeParse(localStorage.getItem(INC_CAT_KEY), JSON.parse(JSON.stringify(DEFAULT_INCOME_CATEGORIES)));
    labels = safeParse(localStorage.getItem(LABEL_KEY), []);
    recurring = safeParse(localStorage.getItem(RECUR_KEY), []);
  }
}

function migrateFromV1() {
  const oldExpenses = safeParse(localStorage.getItem(OLD_EXPENSES_KEY), null);
  const oldCategories = safeParse(localStorage.getItem(OLD_CATEGORIES_KEY), null);
  const oldMerchants = safeParse(localStorage.getItem(OLD_MERCHANTS_KEY), null);

  expenseCategories = oldCategories || JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
  incomeCategories = JSON.parse(JSON.stringify(DEFAULT_INCOME_CATEGORIES));
  labels = oldMerchants || [];
  recurring = [];

  transactions = (oldExpenses || []).map(e => ({
    id: e.id || uid(),
    type: "expense",
    date: e.date,
    categoryId: e.categoryId,
    label: e.merchant || "",
    amount: e.amount,
    createdAt: e.createdAt || new Date().toISOString(),
  }));

  saveTxn(); saveExpCat(); saveIncCat(); saveLabels(); saveRecur();
}

function safeParse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

function saveTxn() { localStorage.setItem(TXN_KEY, JSON.stringify(transactions)); }
function saveExpCat() { localStorage.setItem(EXP_CAT_KEY, JSON.stringify(expenseCategories)); }
function saveIncCat() { localStorage.setItem(INC_CAT_KEY, JSON.stringify(incomeCategories)); }
function saveLabels() { localStorage.setItem(LABEL_KEY, JSON.stringify(labels)); }
function saveRecur() { localStorage.setItem(RECUR_KEY, JSON.stringify(recurring)); }

/* ================= helpers ================= */

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function slugify(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || uid();
}

function formatEUR(amount) {
  return amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function ymOf(dateStr) { return dateStr.slice(0, 7); }

function daysInMonth(year, month1to12) { return new Date(year, month1to12, 0).getDate(); }

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function categoriesFor(type) { return type === "income" ? incomeCategories : expenseCategories; }

function getCategory(type, id) {
  return categoriesFor(type).find(c => c.id === id) || { name: id, emoji: "✨", color: "#E4C1F9" };
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ================= confirm modal (works in iOS standalone mode) ================= */

function showConfirm(message, { okLabel = "Confirmer", cancelLabel = "Annuler", danger = true } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-sheet">
        <h3>Confirmation</h3>
        <p style="font-size:14.5px; font-weight:700; color:var(--plum-soft); line-height:1.5; margin:0 0 18px;">${escapeHTML(message)}</p>
        <div class="modal-actions">
          <button type="button" id="confirmCancelBtn" style="background:var(--cream-2); color:var(--plum);">${escapeHTML(cancelLabel)}</button>
          <button type="button" id="confirmOkBtn" style="background:${danger ? "#FBDDE1" : "var(--mint)"}; color:${danger ? "var(--coral-deep)" : "var(--plum)"};">${escapeHTML(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    function close(result) {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    }
    overlay.querySelector("#confirmOkBtn").addEventListener("click", () => close(true));
    overlay.querySelector("#confirmCancelBtn").addEventListener("click", () => close(false));
    overlay.addEventListener("click", e => { if (e.target === overlay) close(false); });
  });
}

/* ================= recurring engine ================= */

/* Generates any past-due occurrences (up to today) for every active recurring
   template that don't already exist as a transaction. Safe to call repeatedly. */
function generateRecurringOccurrences() {
  const today = todayStr();
  const todayD = new Date(today + "T00:00:00");
  let created = 0;

  recurring.forEach(tpl => {
    if (!tpl.active) return;

    const start = new Date(tpl.startDate + "T00:00:00");
    const end = tpl.endDate ? new Date(tpl.endDate + "T00:00:00") : null;
    const freq = tpl.frequency === "yearly" ? "yearly" : "monthly";

    function tryCreate(occDate) {
      if (occDate < start || occDate > todayD) return;
      if (end && occDate > end) return;
      const occStr = occDate.toISOString().slice(0, 10);
      const exists = transactions.some(t => t.recurringId === tpl.id && t.date === occStr);
      if (exists) return;
      transactions.push({
        id: uid(),
        type: tpl.type,
        date: occStr,
        categoryId: tpl.categoryId,
        label: tpl.label,
        amount: tpl.amount,
        createdAt: new Date().toISOString(),
        recurringId: tpl.id,
      });
      created++;
    }

    if (freq === "monthly") {
      let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const limit = new Date(todayD.getFullYear(), todayD.getMonth(), 1);
      while (cursor <= limit) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth() + 1;
        const day = Math.min(tpl.dayOfMonth, daysInMonth(y, m));
        tryCreate(new Date(y, m - 1, day));
        cursor = new Date(y, m, 1);
      }
    } else {
      // yearly: same month + day, once per year
      for (let y = start.getFullYear(); y <= todayD.getFullYear(); y++) {
        const month = tpl.month || 1;
        const day = Math.min(tpl.dayOfMonth, daysInMonth(y, month));
        tryCreate(new Date(y, month - 1, day));
      }
    }
  });

  if (created > 0) saveTxn();
  return created;
}

/* ================= init ================= */

document.addEventListener("DOMContentLoaded", () => {
  loadAll();
  const created = generateRecurringOccurrences();

  currentMonth = todayStr().slice(0, 7);
  currentYear = new Date().getFullYear();

  document.getElementById("txnDate").value = todayStr();

  wireTabBar();
  wireAddForm();
  wireHistory();
  wireRecurring();
  wireSettings();
  wireMonthSwitcher();
  wireSummaryViewTabs();

  document.getElementById("settingsShortcut").addEventListener("click", () => switchPage("settings"));

  renderAll();
  if (created > 0) showToast(`${created} dépense${created > 1 ? "s" : ""} récurrente${created > 1 ? "s" : ""} ajoutée${created > 1 ? "s" : ""}`);
});

/* ================= tab bar / pages ================= */

function wireTabBar() {
  document.querySelectorAll(".tabbar button").forEach(btn => {
    btn.addEventListener("click", () => switchPage(btn.dataset.page));
  });
}

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  renderMonthLabel();
  if (page === "summary") renderSummary();
  if (page === "history") renderHistory();
  if (page === "recurring") renderRecurring();
  if (page === "settings") renderSettingsCategories();
}

/* ================= summary view (mois / année) ================= */

function wireSummaryViewTabs() {
  document.getElementById("viewTabMonth").addEventListener("click", () => setSummaryView("month"));
  document.getElementById("viewTabYear").addEventListener("click", () => setSummaryView("year"));
}

function setSummaryView(view) {
  summaryView = view;
  document.getElementById("viewTabMonth").classList.toggle("active", view === "month");
  document.getElementById("viewTabYear").classList.toggle("active", view === "year");
  document.getElementById("yearlyBreakdownCard").style.display = view === "year" ? "block" : "none";
  document.getElementById("balanceLabel").textContent = view === "year" ? "Solde de l'année" : "Solde du mois";
  renderMonthLabel();
  renderSummary();
}
/* ================= month/year switcher ================= */

function wireMonthSwitcher() {
  document.getElementById("prevMonthBtn").addEventListener("click", () => shiftPeriod(-1));
  document.getElementById("nextMonthBtn").addEventListener("click", () => shiftPeriod(1));
}

function isYearMode() { return currentPage === "summary" && summaryView === "year"; }

function shiftPeriod(delta) {
  if (isYearMode()) {
    currentYear += delta;
  } else {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  renderAll();
}

function renderMonthLabel() {
  if (isYearMode()) {
    document.getElementById("monthLabel").textContent = String(currentYear);
    updateExcelExportHint();
    return;
  }
  const [y, m] = currentMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  document.getElementById("monthLabel").textContent = capitalize(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  updateExcelExportHint();
}

function updateExcelExportHint() {
  const [y, m] = currentMonth.split("-").map(Number);
  const label = capitalize(new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  const hint = document.getElementById("excelExportHint");
  if (hint) hint.textContent = `Génère un classeur pour ${label} (résumé, répartition par catégorie, détail des opérations).`;
}

/* ================= render orchestration ================= */

function renderAll() {
  renderMonthLabel();
  renderSummary();
  renderHistory();
  refreshCategorySelect();
  refreshLabelList();
}

function monthTransactions() {
  return transactions.filter(t => ymOf(t.date) === currentMonth);
}

function yearTransactions() {
  return transactions.filter(t => t.date.slice(0, 4) === String(currentYear));
}

function periodTransactions() {
  return summaryView === "year" ? yearTransactions() : monthTransactions();
}

/* ================= PAGE: summary ================= */

function renderSummary() {
  const txns = periodTransactions();
  const incomeTotal = txns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenseTotal = txns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  document.getElementById("sumIncome").textContent = formatEUR(incomeTotal);
  document.getElementById("sumExpense").textContent = formatEUR(expenseTotal);
  document.getElementById("sumBalance").textContent = formatEUR(incomeTotal - expenseTotal);

  renderChart("chartArea", "catCountHint", txns.filter(t => t.type === "expense"), expenseTotal, "expense");
  renderChart("incomeChartArea", "incomeCatCountHint", txns.filter(t => t.type === "income"), incomeTotal, "income");
  renderCategoryDiff(txns, expenseTotal, incomeTotal);

  if (summaryView === "year") renderYearlyBreakdown();
}

function renderChart(areaId, hintId, catTxns, total, type) {
  const area = document.getElementById(areaId);
  const hint = document.getElementById(hintId);
  const emptyLabel = type === "income" ? "Aucune recette ce mois-ci" : "Aucune dépense ce mois-ci";
  const emptySub = type === "income" ? "Le graphique apparaîtra dès ta première recette" : "Le graphique apparaîtra dès ta première dépense";
  const centerLabel = type === "income" ? "reçu" : "dépensé";

  if (catTxns.length === 0) {
    hint.textContent = "";
    area.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🍃</div>
        <p>${emptyLabel}</p>
        <span>${emptySub}</span>
      </div>`;
    return;
  }

  const byCat = {};
  catTxns.forEach(t => { byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount; });

  const rows = Object.keys(byCat)
    .map(catId => ({ catId, amount: byCat[catId], cat: getCategory(type, catId) }))
    .sort((a, b) => b.amount - a.amount);

  hint.textContent = `${rows.length} catégorie${rows.length > 1 ? "s" : ""}`;

  let gradientParts = [];
  let cursor = 0;
  rows.forEach(r => {
    const pct = total > 0 ? (r.amount / total) * 100 : 0;
    gradientParts.push(`${r.cat.color} ${cursor}% ${cursor + pct}%`);
    cursor += pct;
  });
  if (cursor < 100) gradientParts.push(`var(--cream-2) ${cursor}% 100%`);

  const legendHTML = rows.map(r => {
    const pct = total > 0 ? (r.amount / total) * 100 : 0;
    return `
      <div class="legend-row">
        <div class="legend-dot" style="background:${r.cat.color};"></div>
        <div class="legend-name">${r.cat.emoji} ${escapeHTML(r.cat.name)}</div>
        <div class="legend-pct">${pct.toFixed(1)}%</div>
        <div class="legend-amt">${formatEUR(r.amount)}</div>
      </div>`;
  }).join("");

  area.innerHTML = `
    <div class="chart-wrap">
      <div class="donut" style="background: conic-gradient(${gradientParts.join(",")});">
        <div class="hole">
          <div class="total">${formatEUR(total)}</div>
          <div class="sub">${centerLabel}</div>
        </div>
      </div>
    </div>
    <div class="legend">${legendHTML}</div>
  `;
}

function renderCategoryDiff(txns, expenseTotal, incomeTotal) {
  const container = document.getElementById("categoryDiffList");
  container.innerHTML = "";

  const byExpenseCat = {};
  txns.filter(t => t.type === "expense").forEach(t => { byExpenseCat[t.categoryId] = (byExpenseCat[t.categoryId] || 0) + t.amount; });
  const byIncomeCat = {};
  txns.filter(t => t.type === "income").forEach(t => { byIncomeCat[t.categoryId] = (byIncomeCat[t.categoryId] || 0) + t.amount; });

  const rows = [
    ...Object.keys(byExpenseCat).map(catId => ({ type: "expense", catId, amount: byExpenseCat[catId], cat: getCategory("expense", catId) })),
    ...Object.keys(byIncomeCat).map(catId => ({ type: "income", catId, amount: byIncomeCat[catId], cat: getCategory("income", catId) })),
  ].sort((a, b) => b.amount - a.amount);

  if (rows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="emoji">⚖️</div>
        <p>Aucune opération à comparer</p>
        <span>Ajoute des recettes et des dépenses pour voir l'écart</span>
      </div>`;
    return;
  }

  const maxAmount = Math.max(...rows.map(r => r.amount));

  container.innerHTML = rows.map(r => {
    const typeTotal = r.type === "income" ? incomeTotal : expenseTotal;
    const pct = typeTotal > 0 ? (r.amount / typeTotal) * 100 : 0;
    const barPct = maxAmount > 0 ? (r.amount / maxAmount) * 100 : 0;
    const barColor = r.type === "income" ? "var(--mint-deep)" : "var(--coral-deep)";
    const sign = r.type === "income" ? "+" : "-";
    return `
      <div class="diff-row">
        <div class="diff-top">
          <div class="diff-name">${r.cat.emoji} ${escapeHTML(r.cat.name)}</div>
          <div class="diff-figures" style="color:${barColor};">${sign}${formatEUR(r.amount)}<span class="pct">${pct.toFixed(1)}%</span></div>
        </div>
        <div class="diff-bar-track"><div class="diff-bar-fill" style="width:${barPct}%; background:${barColor};"></div></div>
      </div>`;
  }).join("");
}

function renderYearlyBreakdown() {
  const list = document.getElementById("yearlyBreakdownList");
  list.innerHTML = "";

  const yearTxns = yearTransactions();
  if (yearTxns.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🗓️</div>
        <p>Aucune opération en ${currentYear}</p>
        <span>Le détail par mois apparaîtra ici</span>
      </div>`;
    return;
  }

  for (let m = 1; m <= 12; m++) {
    const ym = `${currentYear}-${String(m).padStart(2, "0")}`;
    const monthTxns = yearTxns.filter(t => ymOf(t.date) === ym);
    if (monthTxns.length === 0) continue;

    const income = monthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const net = income - expense;

    const label = capitalize(new Date(currentYear, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" }));

    const row = document.createElement("div");
    row.className = "month-row";
    row.innerHTML = `
      <div class="month-name">${label}</div>
      <div class="month-figures">
        <div class="mi">+${formatEUR(income)}</div>
        <div class="me">-${formatEUR(expense)}</div>
      </div>
      <div class="month-net" style="color:${net >= 0 ? "var(--mint-deep)" : "var(--coral-deep)"};">${net >= 0 ? "+" : ""}${formatEUR(net)}</div>
    `;
    list.appendChild(row);
  }
}

/* ================= PAGE: add transaction ================= */

function wireAddForm() {
  document.getElementById("modeExpenseBtn").addEventListener("click", () => setMode("expense"));
  document.getElementById("modeIncomeBtn").addEventListener("click", () => setMode("income"));

  document.getElementById("txnCategory").addEventListener("change", onCategorySelectChange);
  document.getElementById("addCatBtn").addEventListener("click", addCategoryFromInline);
  document.getElementById("newCatInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addCategoryFromInline(); }
  });

  document.getElementById("txnForm").addEventListener("submit", onSubmitTxn);
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById("modeExpenseBtn").classList.toggle("active", mode === "expense");
  document.getElementById("modeIncomeBtn").classList.toggle("active", mode === "income");

  const submitBtn = document.getElementById("txnSubmitBtn");
  submitBtn.className = `submit-btn ${mode}-mode`;
  submitBtn.textContent = mode === "expense" ? "Ajouter la dépense" : "Ajouter la recette";

  document.getElementById("txnLabelLabel").textContent = mode === "expense" ? "Enseigne" : "Source / notes";
  document.getElementById("txnLabel").placeholder = mode === "expense"
    ? "Ex : Carrefour, Total, Amazon…"
    : "Ex : Employeur, virement, remboursement…";

  refreshCategorySelect();
  refreshLabelList();
}

function refreshCategorySelect(selectedId) {
  const select = document.getElementById("txnCategory");
  select.innerHTML = "";
  categoriesFor(currentMode).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.emoji}  ${cat.name}`;
    select.appendChild(opt);
  });
  const addOpt = document.createElement("option");
  addOpt.value = "__add_new__";
  addOpt.textContent = "➕  Nouvelle catégorie…";
  select.appendChild(addOpt);
  if (selectedId) select.value = selectedId;
}

function refreshLabelList() {
  const datalist = document.getElementById("labelList");
  datalist.innerHTML = "";
  labels.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    datalist.appendChild(opt);
  });
}

function onCategorySelectChange(e) {
  const newCatRow = document.getElementById("newCatRow");
  if (e.target.value === "__add_new__") {
    newCatRow.style.display = "flex";
    document.getElementById("newCatInput").focus();
  } else {
    newCatRow.style.display = "none";
  }
}

function addCategoryFromInline() {
  const input = document.getElementById("newCatInput");
  const name = input.value.trim();
  if (!name) return;
  const newCat = createCategory(currentMode, name);
  input.value = "";
  document.getElementById("newCatRow").style.display = "none";
  refreshCategorySelect(newCat.id);
  showToast(`Catégorie "${newCat.name}" ajoutée`);
}

function createCategory(type, name) {
  const list = categoriesFor(type);
  const id = slugify(name);
  const existing = list.find(c => c.id === id);
  if (existing) return existing;
  const color = CAT_COLORS[list.length % CAT_COLORS.length];
  const emoji = type === "income" ? "💶" : "🏷️";
  const newCat = { id, name, emoji, color, default: false };
  list.push(newCat);
  if (type === "income") saveIncCat(); else saveExpCat();
  return newCat;
}

function rememberLabel(name) {
  const clean = (name || "").trim();
  if (!clean) return;
  labels = labels.filter(l => l.toLowerCase() !== clean.toLowerCase());
  labels.unshift(clean);
  labels = labels.slice(0, 60);
  saveLabels();
  refreshLabelList();
}

function onSubmitTxn(e) {
  e.preventDefault();
  const date = document.getElementById("txnDate").value;
  const catSelect = document.getElementById("txnCategory");
  const labelInput = document.getElementById("txnLabel");
  const amountInput = document.getElementById("txnAmount");
  const amount = parseFloat(amountInput.value);
  const label = labelInput.value.trim();

  if (catSelect.value === "__add_new__") { showToast("Choisis un nom pour ta nouvelle catégorie"); return; }
  if (!date || !catSelect.value || isNaN(amount) || amount <= 0) { showToast("Vérifie les champs du formulaire"); return; }

  transactions.push({
    id: uid(),
    type: currentMode,
    date,
    categoryId: catSelect.value,
    label,
    amount: Math.round(amount * 100) / 100,
    createdAt: new Date().toISOString(),
  });
  saveTxn();
  if (label) rememberLabel(label);

  amountInput.value = "";
  labelInput.value = "";

  if (ymOf(date) === currentMonth) { renderSummary(); renderHistory(); }
  showToast(currentMode === "expense" ? "Dépense ajoutée 🌸" : "Recette ajoutée 🌱");
}

/* ================= PAGE: history ================= */

function wireHistory() {
  // rows get their click handlers when rendered
}

function renderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  const txns = monthTransactions();

  if (txns.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🧺</div>
        <p>Aucune opération ce mois-ci</p>
        <span>Ajoute une dépense ou une recette</span>
      </div>`;
    return;
  }

  const sorted = [...txns].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  const groups = {};
  sorted.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });

  Object.keys(groups).forEach(date => {
    const dayIncome = groups[date].filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const dayExpense = groups[date].filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const net = dayIncome - dayExpense;

    const dayDiv = document.createElement("div");
    dayDiv.className = "day-group";
    dayDiv.innerHTML = `
      <div class="day-header">
        <span>${capitalize(formatDateLabel(date))}</span>
        <span>${net >= 0 ? "+" : ""}${formatEUR(net)}</span>
      </div>`;

    groups[date].forEach(t => {
      const cat = getCategory(t.type, t.categoryId);
      const item = document.createElement("div");
      item.className = "txn-item";
      item.innerHTML = `
        <div class="cat-dot" style="background:${cat.color}33;">${cat.emoji}</div>
        <div class="txn-info">
          <div class="cat-name">${escapeHTML(cat.name)}${t.label ? ` · ${escapeHTML(t.label)}` : ""}</div>
          <div class="txn-sub">${t.recurringId ? "🔁 " : ""}${t.syncKey ? "🔗 " : ""}${t.type === "income" ? "Recette" : "Dépense"}</div>
        </div>
        <div class="txn-amount ${t.type}">${t.type === "expense" ? "-" : "+"}${formatEUR(t.amount)}</div>
      `;
      item.addEventListener("click", () => openTxnEditor(t.id));
      dayDiv.appendChild(item);
    });

    list.appendChild(dayDiv);
  });
}

function openTxnEditor(id) {
  const txn = transactions.find(t => t.id === id);
  if (!txn) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <h3>${txn.type === "income" ? "Modifier la recette" : "Modifier la dépense"} <button id="closeEditBtn">✕</button></h3>
      <div class="field">
        <label>Date</label>
        <input type="date" id="editDate" value="${txn.date}">
      </div>
      <div class="field">
        <label>Catégorie</label>
        <select id="editCategory"></select>
      </div>
      <div class="field">
        <label>${txn.type === "income" ? "Source / notes" : "Enseigne"}</label>
        <input type="text" id="editLabel" value="${escapeHTML(txn.label || "")}">
      </div>
      <div class="field amount-field">
        <label>Montant</label>
        <input type="number" id="editAmount" step="0.01" min="0" value="${txn.amount}">
      </div>
      <div class="modal-actions">
        <button type="button" id="deleteEditBtn" style="background:#FBDDE1; color:var(--coral-deep);">Supprimer</button>
        <button type="button" id="saveEditBtn" style="background:var(--lavender-deep); color:white;">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  const catSelect = overlay.querySelector("#editCategory");
  categoriesFor(txn.type).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.emoji}  ${cat.name}`;
    catSelect.appendChild(opt);
  });
  catSelect.value = txn.categoryId;

  function close() {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.querySelector("#closeEditBtn").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  overlay.querySelector("#saveEditBtn").addEventListener("click", () => {
    const date = overlay.querySelector("#editDate").value;
    const categoryId = catSelect.value;
    const label = overlay.querySelector("#editLabel").value.trim();
    const amount = parseFloat(overlay.querySelector("#editAmount").value);

    if (!date || !categoryId || isNaN(amount) || amount <= 0) { showToast("Vérifie les champs"); return; }

    txn.date = date;
    txn.categoryId = categoryId;
    txn.label = label;
    txn.amount = Math.round(amount * 100) / 100;
    saveTxn();
    if (label) rememberLabel(label);

    close();
    renderSummary();
    renderHistory();
    showToast("Modification enregistrée");
  });

  overlay.querySelector("#deleteEditBtn").addEventListener("click", async () => {
    const ok = await showConfirm("Supprimer cette opération ?", { okLabel: "Supprimer" });
    if (!ok) return;
    transactions = transactions.filter(t => t.id !== id);
    saveTxn();
    close();
    renderSummary();
    renderHistory();
    showToast("Opération supprimée");
  });
}

/* ================= PAGE: recurring ================= */

function wireRecurring() {
  document.getElementById("openAddRecurBtn").addEventListener("click", () => openRecurEditor(null));
}

function renderRecurring() {
  const list = document.getElementById("recurringList");
  list.innerHTML = "";

  if (recurring.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🔁</div>
        <p>Aucune récurrence configurée</p>
        <span>Ajoute un loyer, un abonnement, un salaire…</span>
      </div>`;
    return;
  }

  const MONTH_NAMES = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const sorted = [...recurring].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  sorted.forEach(tpl => {
    const cat = getCategory(tpl.type, tpl.categoryId);
    const freqText = tpl.frequency === "yearly"
      ? `le ${tpl.dayOfMonth} ${MONTH_NAMES[(tpl.month || 1) - 1]}, chaque année`
      : `le ${tpl.dayOfMonth} de chaque mois`;
    const row = document.createElement("div");
    row.className = "recur-item" + (tpl.active ? "" : " inactive");
    row.innerHTML = `
      <div class="cat-dot" style="background:${cat.color}33;">${cat.emoji}</div>
      <div class="recur-info">
        <div class="recur-name">${escapeHTML(tpl.label || cat.name)}</div>
        <div class="recur-sub">${cat.name} · ${freqText}</div>
      </div>
      <div class="recur-amount ${tpl.type === "expense" ? "" : ""}" style="color:${tpl.type === "income" ? "var(--mint-deep)" : "var(--coral-deep)"};">
        ${tpl.type === "expense" ? "-" : "+"}${formatEUR(tpl.amount)}
      </div>
      <button class="recur-toggle ${tpl.active ? "on" : ""}" title="Activer / désactiver"></button>
    `;
    row.querySelector(".recur-toggle").addEventListener("click", () => {
      tpl.active = !tpl.active;
      saveRecur();
      const created = generateRecurringOccurrences();
      renderRecurring();
      if (created > 0) { renderSummary(); renderHistory(); showToast(`${created} occurrence${created > 1 ? "s" : ""} générée${created > 1 ? "s" : ""}`); }
    });
    row.addEventListener("click", (e) => {
      if (e.target.closest(".recur-toggle")) return;
      openRecurEditor(tpl.id);
    });
    list.appendChild(row);
  });
}

function openRecurEditor(id) {
  const existing = id ? recurring.find(r => r.id === id) : null;
  const type = existing ? existing.type : "expense";
  const freq = existing && existing.frequency === "yearly" ? "yearly" : "monthly";

  const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const defaultMonth = existing ? existing.month : new Date().getMonth() + 1;
  const monthOptionsHTML = MONTH_NAMES.map((name, i) => {
    const val = i + 1;
    return `<option value="${val}" ${defaultMonth === val ? "selected" : ""}>${name}</option>`;
  }).join("");

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <h3>${existing ? "Modifier la récurrence" : "Nouvelle récurrence"} <button id="closeRecurBtn">✕</button></h3>

      <div class="segmented">
        <button type="button" class="recur-mode-btn expense-mode ${type === "expense" ? "active" : ""}" data-type="expense">➖ Dépense</button>
        <button type="button" class="recur-mode-btn income-mode ${type === "income" ? "active" : ""}" data-type="income">➕ Recette</button>
      </div>

      <div class="subtabs">
        <button type="button" class="recur-freq-btn ${freq === "monthly" ? "active" : ""}" data-freq="monthly">Mensuelle</button>
        <button type="button" class="recur-freq-btn ${freq === "yearly" ? "active" : ""}" data-freq="yearly">Annuelle</button>
      </div>

      <div class="field">
        <label>Nom</label>
        <input type="text" id="recurLabel" placeholder="Ex : Loyer, Netflix, Taxe foncière…" value="${existing ? escapeHTML(existing.label || "") : ""}">
      </div>
      <div class="field">
        <label>Catégorie</label>
        <select id="recurCategory"></select>
      </div>
      <div class="field amount-field">
        <label>Montant</label>
        <input type="number" id="recurAmount" step="0.01" min="0" value="${existing ? existing.amount : ""}">
      </div>
      <div class="field" id="recurMonthField" style="display:${freq === "yearly" ? "block" : "none"};">
        <label>Mois</label>
        <select id="recurMonth">${monthOptionsHTML}</select>
      </div>
      <div class="field">
        <label id="recurDayLabel">${freq === "yearly" ? "Jour du mois" : "Jour du mois"}</label>
        <input type="number" id="recurDay" min="1" max="31" value="${existing ? existing.dayOfMonth : 1}">
      </div>
      <div class="field">
        <label>Date de début</label>
        <input type="date" id="recurStart" value="${existing ? existing.startDate : todayStr()}">
      </div>
      <div class="field">
        <label>Date de fin (optionnelle)</label>
        <input type="date" id="recurEnd" value="${existing && existing.endDate ? existing.endDate : ""}">
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="recurActive" ${!existing || existing.active ? "checked" : ""}>
        <label for="recurActive">Active</label>
      </div>

      <div class="modal-actions">
        ${existing ? '<button type="button" id="deleteRecurBtn" style="background:#FBDDE1; color:var(--coral-deep);">Supprimer</button>' : ""}
        <button type="button" id="saveRecurBtn" style="background:var(--lavender-deep); color:white;">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  let recurType = type;
  let recurFreq = freq;

  function fillCategorySelect() {
    const sel = overlay.querySelector("#recurCategory");
    sel.innerHTML = "";
    categoriesFor(recurType).forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.emoji}  ${cat.name}`;
      sel.appendChild(opt);
    });
    if (existing && existing.type === recurType) sel.value = existing.categoryId;
  }
  fillCategorySelect();

  overlay.querySelectorAll(".recur-mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      recurType = btn.dataset.type;
      overlay.querySelectorAll(".recur-mode-btn").forEach(b => b.classList.toggle("active", b.dataset.type === recurType));
      fillCategorySelect();
    });
  });

  overlay.querySelectorAll(".recur-freq-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      recurFreq = btn.dataset.freq;
      overlay.querySelectorAll(".recur-freq-btn").forEach(b => b.classList.toggle("active", b.dataset.freq === recurFreq));
      overlay.querySelector("#recurMonthField").style.display = recurFreq === "yearly" ? "block" : "none";
    });
  });

  function close() {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  }
  overlay.querySelector("#closeRecurBtn").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  overlay.querySelector("#saveRecurBtn").addEventListener("click", () => {
    const label = overlay.querySelector("#recurLabel").value.trim();
    const categoryId = overlay.querySelector("#recurCategory").value;
    const amount = parseFloat(overlay.querySelector("#recurAmount").value);
    const dayOfMonth = parseInt(overlay.querySelector("#recurDay").value, 10);
    const month = parseInt(overlay.querySelector("#recurMonth").value, 10);
    const startDate = overlay.querySelector("#recurStart").value;
    const endDate = overlay.querySelector("#recurEnd").value || null;
    const active = overlay.querySelector("#recurActive").checked;

    if (!label || !categoryId || isNaN(amount) || amount <= 0 || !dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31 || !startDate) {
      showToast("Vérifie les champs de la récurrence");
      return;
    }

    const payload = {
      type: recurType, categoryId, label, amount: Math.round(amount * 100) / 100,
      frequency: recurFreq, dayOfMonth, month: recurFreq === "yearly" ? month : null,
      startDate, endDate, active,
    };

    if (existing) {
      Object.assign(existing, payload);
    } else {
      recurring.push({ id: uid(), ...payload });
    }
    saveRecur();
    const created = generateRecurringOccurrences();

    close();
    renderRecurring();
    renderSummary();
    renderHistory();
    showToast(created > 0 ? `Récurrence enregistrée (${created} occurrence${created > 1 ? "s" : ""} générée${created > 1 ? "s" : ""})` : "Récurrence enregistrée");
  });

  const deleteBtn = overlay.querySelector("#deleteRecurBtn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const ok = await showConfirm("Supprimer cette récurrence ? Les opérations déjà générées resteront dans l'historique.", { okLabel: "Supprimer" });
      if (!ok) return;
      recurring = recurring.filter(r => r.id !== existing.id);
      saveRecur();
      close();
      renderRecurring();
      showToast("Récurrence supprimée");
    });
  }
}

/* ================= PAGE: settings ================= */

function wireSettings() {
  document.getElementById("catTabExpense").addEventListener("click", () => setSettingsCatType("expense"));
  document.getElementById("catTabIncome").addEventListener("click", () => setSettingsCatType("income"));
  document.getElementById("settingsAddCatBtn").addEventListener("click", addCategoryFromSettings);
  document.getElementById("settingsNewCatInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addCategoryFromSettings(); }
  });

  document.getElementById("exportBtn").addEventListener("click", exportJSON);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", importJSON);
  document.getElementById("resetBtn").addEventListener("click", resetAll);
  document.getElementById("exportExcelBtn").addEventListener("click", exportMonthExcel);
}

function setSettingsCatType(type) {
  currentSettingsCatType = type;
  document.getElementById("catTabExpense").classList.toggle("active", type === "expense");
  document.getElementById("catTabIncome").classList.toggle("active", type === "income");
  renderSettingsCategories();
}

function renderSettingsCategories() {
  const container = document.getElementById("settingsCatList");
  container.innerHTML = "";
  categoriesFor(currentSettingsCatType).forEach(cat => {
    const row = document.createElement("div");
    row.className = "cat-manage-row" + (cat.default ? " is-default" : "");
    row.innerHTML = `
      <div class="cat-dot" style="background:${cat.color}33;">${cat.emoji}</div>
      <div class="cat-manage-name">${escapeHTML(cat.name)}</div>
      <button ${cat.default ? "disabled" : ""} title="Supprimer">🗑️</button>
    `;
    if (!cat.default) {
      row.querySelector("button").addEventListener("click", async () => {
        const inUse = transactions.some(t => t.type === currentSettingsCatType && t.categoryId === cat.id);
        if (inUse) {
          const ok = await showConfirm(
            `"${cat.name}" est utilisée par des opérations existantes. Elle restera affichée sur ces opérations mais ne sera plus proposée. Continuer ?`,
            { okLabel: "Supprimer" }
          );
          if (!ok) return;
        }
        const list = categoriesFor(currentSettingsCatType);
        const idx = list.findIndex(c => c.id === cat.id);
        list.splice(idx, 1);
        if (currentSettingsCatType === "income") saveIncCat(); else saveExpCat();
        renderSettingsCategories();
        refreshCategorySelect();
      });
    }
    container.appendChild(row);
  });
}

function addCategoryFromSettings() {
  const input = document.getElementById("settingsNewCatInput");
  const name = input.value.trim();
  if (!name) return;
  const cat = createCategory(currentSettingsCatType, name);
  input.value = "";
  renderSettingsCategories();
  refreshCategorySelect();
  showToast(`Catégorie "${cat.name}" ajoutée`);
}

/* ================= import / export ================= */

function exportJSON() {
  const payload = {
    app: "mes-sous",
    version: 2,
    exportedAt: new Date().toISOString(),
    expenseCategories,
    incomeCategories,
    labels,
    recurring,
    transactions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `mes-sous-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Export JSON téléchargé");
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      let data = JSON.parse(reader.result);

      // Ancien format (v1) : { expenses, categories, merchants } — on le convertit à la volée.
      if (!Array.isArray(data.transactions) && Array.isArray(data.expenses)) {
        data = {
          expenseCategories: data.categories,
          incomeCategories: null,
          labels: data.merchants,
          recurring: null,
          transactions: data.expenses.map(x => ({
            id: x.id || uid(),
            type: "expense",
            date: x.date,
            categoryId: x.categoryId,
            label: x.merchant || "",
            amount: x.amount,
            createdAt: x.createdAt || new Date().toISOString(),
          })),
        };
      }

      if (!Array.isArray(data.transactions)) throw new Error("Format invalide");

      const replace = await showConfirm(
        "Remplacer toutes les données actuelles par ce fichier ? Choisis \"Fusionner\" pour garder tes données existantes et ajouter celles du fichier.",
        { okLabel: "Remplacer tout", cancelLabel: "Fusionner", danger: false }
      );

      mergeOrReplace("expenseCategories", data.expenseCategories, replace, "id");
      mergeOrReplace("incomeCategories", data.incomeCategories, replace, "id");
      mergeOrReplace("recurring", data.recurring, replace, "id");

      if (Array.isArray(data.labels)) {
        if (replace) labels = data.labels;
        else data.labels.forEach(l => { if (!labels.find(x => x.toLowerCase() === l.toLowerCase())) labels.push(l); });
        saveLabels();
      }

      if (replace) {
        transactions = data.transactions;
      } else {
        data.transactions.forEach(x => {
          // Opérations synchronisées depuis une autre appli (ex. RH & NDF) : on les
          // met à jour en place plutôt que d'en créer une nouvelle à chaque envoi.
          if (x.syncKey) {
            const idx = transactions.findIndex(t => t.syncKey === x.syncKey);
            if (idx !== -1) {
              transactions[idx] = { ...transactions[idx], ...x, id: transactions[idx].id };
              return;
            }
          }
          const idExists = transactions.some(t => t.id === x.id);
          transactions.push(idExists ? { ...x, id: uid() } : x);
        });
      }
      saveTxn(); saveExpCat(); saveIncCat(); saveRecur();

      generateRecurringOccurrences();
      renderAll();
      renderRecurring();
      renderSettingsCategories();
      showToast("Import réussi ✅");
    } catch (err) {
      showToast("Fichier JSON invalide");
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
}

function mergeOrReplace(varName, incoming, replace, key) {
  if (!Array.isArray(incoming)) return;
  if (varName === "expenseCategories") {
    expenseCategories = replace ? incoming : mergeArrays(expenseCategories, incoming, key);
  } else if (varName === "incomeCategories") {
    incomeCategories = replace ? incoming : mergeArrays(incomeCategories, incoming, key);
  } else if (varName === "recurring") {
    recurring = replace ? incoming : mergeArrays(recurring, incoming, key);
  }
}

function mergeArrays(current, incoming, key) {
  const result = [...current];
  incoming.forEach(item => {
    if (!result.find(x => x[key] === item[key])) result.push(item);
  });
  return result;
}

/* ================= export Excel mensuel ================= */

function ensureExcelJSLoaded() {
  return new Promise((resolve, reject) => {
    if (window.ExcelJS) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(script);
  });
}

const XLS_COLORS = {
  cream: "FFFDF6EF",
  cream2: "FFFBEFE2",
  lavender: "FFC9B6E8",
  lavenderDeep: "FF9B7FD1",
  mint: "FFA9E4D0",
  mintDeep: "FF5EBE9A",
  coral: "FFFF8FA3",
  coralDeep: "FFE85D74",
  peach: "FFFFD1A9",
  plum: "FF4A3B52",
  plumSoft: "FF7A6B85",
  white: "FFFFFFFF",
};

function xlsGroupByCategory(list, type) {
  const map = {};
  list.forEach(t => { map[t.categoryId] = (map[t.categoryId] || 0) + t.amount; });
  return Object.keys(map)
    .map(id => ({ cat: getCategory(type, id), amount: map[id] }))
    .sort((a, b) => b.amount - a.amount);
}

function xlsBanner(ws, row, text, fillArgb, fontArgb) {
  ws.mergeCells(`B${row}:F${row}`);
  const cell = ws.getCell(`B${row}`);
  cell.value = text;
  cell.font = { bold: true, size: 11, color: { argb: fontArgb || XLS_COLORS.plum } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 22;
}

function xlsTableHeader(ws, row, labels) {
  // labels: [ [col, text], ... ]
  labels.forEach(([col, text]) => {
    const cell = ws.getCell(`${col}${row}`);
    cell.value = text;
    cell.font = { bold: true, size: 9.5, color: { argb: XLS_COLORS.plumSoft } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLS_COLORS.cream2 } };
    cell.alignment = { vertical: "middle", horizontal: col === "B" ? "left" : "right" };
  });
  ws.getRow(row).height = 18;
}

async function exportMonthExcel() {
  showToast("Génération du fichier Excel…");
  try {
    await ensureExcelJSLoaded();
  } catch (e) {
    showToast("Connexion internet nécessaire pour générer le fichier Excel");
    return;
  }

  const [y, m] = currentMonth.split("-").map(Number);
  const monthDate = new Date(y, m - 1, 1);
  const monthTitle = monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
  const sheetName = monthDate.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }).replace(".", "").slice(0, 31);

  const txns = monthTransactions().slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const incomeTxns = txns.filter(t => t.type === "income");
  const expenseTxns = txns.filter(t => t.type === "expense");
  const incomeTotal = incomeTxns.reduce((s, t) => s + t.amount, 0);
  const expenseTotal = expenseTxns.reduce((s, t) => s + t.amount, 0);
  const solde = incomeTotal - expenseTotal;

  const expenseByCat = xlsGroupByCategory(expenseTxns, "expense");
  const incomeByCat = xlsGroupByCategory(incomeTxns, "income");

  const ExcelJS = window.ExcelJS;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mes Sous";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });

  ws.columns = [
    { width: 3 }, { width: 22 }, { width: 16 }, { width: 18 }, { width: 20 }, { width: 14 }, { width: 3 },
  ];

  let row = 1;

  // --- titre ---
  ws.mergeCells(`B${row}:F${row}`);
  const titleCell = ws.getCell(`B${row}`);
  titleCell.value = monthTitle;
  titleCell.font = { bold: true, size: 26, color: { argb: XLS_COLORS.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLS_COLORS.lavenderDeep } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 42;
  row++;

  ws.mergeCells(`B${row}:F${row}`);
  const subCell = ws.getCell(`B${row}`);
  subCell.value = `Généré le ${new Date().toLocaleDateString("fr-FR")} — Mes Sous`;
  subCell.font = { italic: true, size: 8.5, color: { argb: XLS_COLORS.plumSoft } };
  subCell.alignment = { horizontal: "left", indent: 1 };
  row += 2;

  // --- résumé du mois ---
  xlsBanner(ws, row, "RÉSUMÉ DU MOIS", XLS_COLORS.lavender, XLS_COLORS.plum);
  row++;

  const summaryRows = [
    { label: "Recettes", amount: incomeTotal, color: XLS_COLORS.mintDeep },
    { label: "Dépenses", amount: expenseTotal, color: XLS_COLORS.coralDeep },
  ];
  summaryRows.forEach(r => {
    ws.mergeCells(`B${row}:D${row}`);
    ws.getCell(`B${row}`).value = r.label;
    ws.getCell(`B${row}`).font = { bold: true, size: 10, color: { argb: XLS_COLORS.plum } };
    const amt = ws.getCell(`F${row}`);
    amt.value = r.amount;
    amt.numFmt = '#,##0.00 "€"';
    amt.font = { bold: true, size: 10, color: { argb: r.color } };
    amt.alignment = { horizontal: "right" };
    row++;
  });

  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = "Solde du mois";
  ws.getCell(`B${row}`).font = { bold: true, size: 11, color: { argb: XLS_COLORS.plum } };
  const soldeCell = ws.getCell(`F${row}`);
  soldeCell.value = solde;
  soldeCell.numFmt = '#,##0.00 "€"';
  soldeCell.font = { bold: true, size: 11, color: { argb: solde >= 0 ? XLS_COLORS.mintDeep : XLS_COLORS.coralDeep } };
  soldeCell.alignment = { horizontal: "right" };
  ["B", "C", "D", "E", "F"].forEach(col => {
    ws.getCell(`${col}${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLS_COLORS.cream2 } };
  });
  ws.getRow(row).height = 20;
  row += 2;

  // --- recettes par catégorie ---
  row = xlsCategorySection(ws, row, "RECETTES PAR CATÉGORIE", XLS_COLORS.mint, incomeByCat, incomeTotal, "Aucune recette ce mois-ci");
  row++;

  // --- dépenses par catégorie ---
  row = xlsCategorySection(ws, row, "DÉPENSES PAR CATÉGORIE", XLS_COLORS.coral, expenseByCat, expenseTotal, "Aucune dépense ce mois-ci");
  row++;

  // --- suivi des opérations ---
  xlsBanner(ws, row, "SUIVI DES OPÉRATIONS", XLS_COLORS.peach, XLS_COLORS.plum);
  row++;
  xlsTableHeader(ws, row, [["B", "Date"], ["C", "Type"], ["D", "Catégorie"], ["E", "Enseigne"], ["F", "Montant"]]);
  row++;

  if (txns.length === 0) {
    ws.mergeCells(`B${row}:F${row}`);
    ws.getCell(`B${row}`).value = "Aucune opération ce mois-ci";
    ws.getCell(`B${row}`).font = { italic: true, size: 9.5, color: { argb: XLS_COLORS.plumSoft } };
    row++;
  } else {
    txns.forEach((t, i) => {
      const cat = getCategory(t.type, t.categoryId);
      const bg = i % 2 === 0 ? XLS_COLORS.white : XLS_COLORS.cream;
      const dateCell = ws.getCell(`B${row}`);
      dateCell.value = new Date(t.date + "T00:00:00");
      dateCell.numFmt = "dd/mm/yyyy";
      ws.getCell(`C${row}`).value = t.type === "income" ? "Recette" : "Dépense";
      ws.getCell(`D${row}`).value = `${cat.emoji} ${cat.name}`;
      ws.getCell(`E${row}`).value = t.label || "";
      const amtCell = ws.getCell(`F${row}`);
      amtCell.value = t.type === "expense" ? -t.amount : t.amount;
      amtCell.numFmt = '#,##0.00 "€";[' + (t.type === "expense" ? "Red" : "Black") + ']-#,##0.00 "€"';
      amtCell.alignment = { horizontal: "right" };
      ["B", "C", "D", "E", "F"].forEach(col => {
        const c = ws.getCell(`${col}${row}`);
        c.font = c.font || { size: 9.5, color: { argb: XLS_COLORS.plum } };
        if (!c.font.size) c.font = { size: 9.5, color: { argb: XLS_COLORS.plum } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      });
      row++;
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mes-sous-${currentMonth}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Fichier Excel téléchargé 📊");
}

function xlsCategorySection(ws, row, title, fillColor, rows, total, emptyMessage) {
  xlsBanner(ws, row, title, fillColor, XLS_COLORS.plum);
  row++;
  xlsTableHeader(ws, row, [["B", "Catégorie"], ["E", "%"], ["F", "Montant"]]);
  row++;

  if (rows.length === 0) {
    ws.mergeCells(`B${row}:F${row}`);
    ws.getCell(`B${row}`).value = emptyMessage;
    ws.getCell(`B${row}`).font = { italic: true, size: 9.5, color: { argb: XLS_COLORS.plumSoft } };
    row++;
    return row;
  }

  rows.forEach((r, i) => {
    const pct = total > 0 ? r.amount / total : 0;
    const bg = i % 2 === 0 ? XLS_COLORS.white : XLS_COLORS.cream;
    ws.getCell(`B${row}`).value = `${r.cat.emoji} ${r.cat.name}`;
    ws.getCell(`B${row}`).font = { size: 9.5, color: { argb: XLS_COLORS.plum } };
    const pctCell = ws.getCell(`E${row}`);
    pctCell.value = pct;
    pctCell.numFmt = "0.0%";
    pctCell.alignment = { horizontal: "right" };
    pctCell.font = { size: 9.5, color: { argb: XLS_COLORS.plumSoft } };
    const amtCell = ws.getCell(`F${row}`);
    amtCell.value = r.amount;
    amtCell.numFmt = '#,##0.00 "€"';
    amtCell.alignment = { horizontal: "right" };
    amtCell.font = { size: 9.5, color: { argb: XLS_COLORS.plum } };
    ["B", "C", "D", "E", "F"].forEach(col => {
      ws.getCell(`${col}${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    });
    row++;
  });

  // total
  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = "Total";
  ws.getCell(`B${row}`).font = { bold: true, size: 9.5, color: { argb: XLS_COLORS.plum } };
  const totalCell = ws.getCell(`F${row}`);
  totalCell.value = total;
  totalCell.numFmt = '#,##0.00 "€"';
  totalCell.font = { bold: true, size: 9.5, color: { argb: XLS_COLORS.plum } };
  totalCell.alignment = { horizontal: "right" };
  ["B", "C", "D", "E", "F"].forEach(col => {
    ws.getCell(`${col}${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLS_COLORS.cream2 } };
  });
  row++;
  return row;
}

async function resetAll() {
  const sure = await showConfirm(
    "Toutes les dépenses, recettes, récurrences et catégories personnalisées seront définitivement supprimées.",
    { okLabel: "Tout supprimer" }
  );
  if (!sure) return;

  transactions = [];
  expenseCategories = JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
  incomeCategories = JSON.parse(JSON.stringify(DEFAULT_INCOME_CATEGORIES));
  labels = [];
  recurring = [];

  saveTxn(); saveExpCat(); saveIncCat(); saveLabels(); saveRecur();

  renderAll();
  renderRecurring();
  renderSettingsCategories();
  showToast("Application réinitialisée");
}
