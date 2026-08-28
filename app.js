/* ===================== Mes Sous — suivi de dépenses ===================== */

const STORAGE_KEY = "mesSous.expenses.v1";
const CATEGORY_KEY = "mesSous.categories.v1";

const DEFAULT_CATEGORIES = [
  { id: "alimentation", name: "Alimentation", emoji: "🍎", color: "#A9E4D0", default: true },
  { id: "transport",    name: "Transport",    emoji: "🚗", color: "#C9B6E8", default: true },
  { id: "logement",     name: "Logement",     emoji: "🏠", color: "#FFD1A9", default: true },
  { id: "loisirs",      name: "Loisirs",      emoji: "🎉", color: "#FF8FA3", default: true },
  { id: "sante",        name: "Santé",        emoji: "💊", color: "#9FD3F0", default: true },
  { id: "autres",       name: "Autres",       emoji: "✨", color: "#E4C1F9", default: true },
];

const CAT_COLORS = ["#A9E4D0", "#C9B6E8", "#FFD1A9", "#FF8FA3", "#9FD3F0", "#E4C1F9", "#FFE29A", "#B5EAD7"];

let expenses = [];
let categories = [];

/* ---------- persistence ---------- */

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    expenses = raw ? JSON.parse(raw) : [];
  } catch (e) {
    expenses = [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORY_KEY);
    categories = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  } catch (e) {
    categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  }
}

function saveCategories() {
  localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
}

/* ---------- helpers ---------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || uid();
}

function formatEUR(amount) {
  return amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

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

function getCategory(id) {
  return categories.find(c => c.id === id) || { name: id, emoji: "✨", color: "#E4C1F9" };
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ---------- category select ---------- */

function renderCategorySelect(selectedId) {
  const select = document.getElementById("categorySelect");
  select.innerHTML = "";

  categories.forEach(cat => {
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

document.addEventListener("DOMContentLoaded", () => {
  loadExpenses();
  loadCategories();

  const dateInput = document.getElementById("dateInput");
  dateInput.value = new Date().toISOString().slice(0, 10);

  renderCategorySelect();
  renderExpenses();
  updateMonthTotal();

  document.getElementById("categorySelect").addEventListener("change", onCategoryChange);
  document.getElementById("addCatBtn").addEventListener("click", addCategoryFromInline);
  document.getElementById("newCatInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addCategoryFromInline(); }
  });

  document.getElementById("expenseForm").addEventListener("submit", onSubmitExpense);

  document.getElementById("exportBtn").addEventListener("click", exportJSON);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", importJSON);

  document.getElementById("categoryManageBtn").addEventListener("click", openCategoryManager);

  document.getElementById("resetBtn").addEventListener("click", resetAll);
});

function resetAll() {
  const sure = confirm("Tout réinitialiser ?\nToutes les dépenses et les catégories personnalisées seront définitivement supprimées.");
  if (!sure) return;

  expenses = [];
  categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  saveExpenses();
  saveCategories();

  renderCategorySelect();
  renderExpenses();
  updateMonthTotal();
  showToast("Application réinitialisée");
}

function onCategoryChange(e) {
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

  const newCat = createCategory(name);
  input.value = "";
  document.getElementById("newCatRow").style.display = "none";
  renderCategorySelect(newCat.id);
  showToast(`Catégorie "${newCat.name}" ajoutée`);
}

function createCategory(name) {
  const id = slugify(name);
  const existing = categories.find(c => c.id === id);
  if (existing) return existing;

  const color = CAT_COLORS[categories.length % CAT_COLORS.length];
  const newCat = { id, name, emoji: "🏷️", color, default: false };
  categories.push(newCat);
  saveCategories();
  return newCat;
}

/* ---------- expense form ---------- */

function onSubmitExpense(e) {
  e.preventDefault();

  const date = document.getElementById("dateInput").value;
  const catSelect = document.getElementById("categorySelect");
  const amountInput = document.getElementById("amountInput");
  const amount = parseFloat(amountInput.value);

  if (catSelect.value === "__add_new__") {
    showToast("Choisis un nom pour ta nouvelle catégorie");
    return;
  }
  if (!date || !catSelect.value || isNaN(amount) || amount <= 0) {
    showToast("Vérifie les champs du formulaire");
    return;
  }

  expenses.push({
    id: uid(),
    date,
    categoryId: catSelect.value,
    amount: Math.round(amount * 100) / 100,
    createdAt: new Date().toISOString(),
  });

  saveExpenses();
  amountInput.value = "";
  renderExpenses();
  updateMonthTotal();
  showToast("Dépense ajoutée 🌸");
}

/* ---------- rendering ---------- */

function renderExpenses() {
  const list = document.getElementById("expenseList");
  list.innerHTML = "";

  if (expenses.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🧺</div>
        <p>Aucune dépense pour l'instant</p>
        <span>Ajoute ta première dépense ci-dessus</span>
      </div>`;
    return;
  }

  const sorted = [...expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));

  const groups = {};
  sorted.forEach(exp => {
    if (!groups[exp.date]) groups[exp.date] = [];
    groups[exp.date].push(exp);
  });

  Object.keys(groups).forEach(date => {
    const dayTotal = groups[date].reduce((s, e) => s + e.amount, 0);

    const dayDiv = document.createElement("div");
    dayDiv.className = "day-group";
    dayDiv.innerHTML = `
      <div class="day-header">
        <span>${capitalize(formatDateLabel(date))}</span>
        <span>${formatEUR(dayTotal)}</span>
      </div>`;

    groups[date].forEach(exp => {
      const cat = getCategory(exp.categoryId);
      const item = document.createElement("div");
      item.className = "expense-item";
      item.innerHTML = `
        <div class="cat-dot" style="background:${cat.color}33;">${cat.emoji}</div>
        <div class="expense-info">
          <div class="cat-name">${escapeHTML(cat.name)}</div>
          <div class="expense-date">${escapeHTML(exp.date)}</div>
        </div>
        <div class="expense-amount">${formatEUR(exp.amount)}</div>
        <button class="delete-btn" data-id="${exp.id}" title="Supprimer">✕</button>
      `;
      item.querySelector(".delete-btn").addEventListener("click", () => deleteExpense(exp.id));
      dayDiv.appendChild(item);
    });

    list.appendChild(dayDiv);
  });
}

function deleteExpense(id) {
  expenses = expenses.filter(e => e.id !== id);
  saveExpenses();
  renderExpenses();
  updateMonthTotal();
  showToast("Dépense supprimée");
}

function updateMonthTotal() {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  const monthExpenses = expenses.filter(e => e.date.slice(0, 7) === ym);
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);

  document.getElementById("monthTotal").textContent = formatEUR(total);
  document.getElementById("monthSub").textContent =
    monthExpenses.length === 0
      ? "Aucune dépense enregistrée"
      : `${monthExpenses.length} dépense${monthExpenses.length > 1 ? "s" : ""} ce mois-ci`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- category manager modal ---------- */

function openCategoryManager() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <h3>Gérer les catégories <button id="closeCatManager">✕</button></h3>
      <div id="catManageList"></div>
      <div class="new-cat-row" style="margin-top:12px;">
        <input type="text" id="manageNewCatInput" placeholder="Nouvelle catégorie">
        <button type="button" id="manageAddCatBtn">Ajouter</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  function renderList() {
    const container = overlay.querySelector("#catManageList");
    container.innerHTML = "";
    categories.forEach(cat => {
      const row = document.createElement("div");
      row.className = "cat-manage-row" + (cat.default ? " is-default" : "");
      row.innerHTML = `
        <div class="cat-dot" style="background:${cat.color}33;">${cat.emoji}</div>
        <div class="cat-manage-name">${escapeHTML(cat.name)}</div>
        <button ${cat.default ? "disabled" : ""} title="Supprimer">🗑️</button>
      `;
      if (!cat.default) {
        row.querySelector("button").addEventListener("click", () => {
          const inUse = expenses.some(e => e.categoryId === cat.id);
          if (inUse && !confirm(`"${cat.name}" est utilisée par des dépenses existantes. Elle restera affichée sur ces dépenses mais ne sera plus proposée. Continuer ?`)) return;
          categories = categories.filter(c => c.id !== cat.id);
          saveCategories();
          renderCategorySelect();
          renderList();
        });
      }
      container.appendChild(row);
    });
  }
  renderList();

  overlay.querySelector("#closeCatManager").addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });

  overlay.querySelector("#manageAddCatBtn").addEventListener("click", () => {
    const input = overlay.querySelector("#manageNewCatInput");
    const name = input.value.trim();
    if (!name) return;
    createCategory(name);
    input.value = "";
    renderCategorySelect();
    renderList();
  });
  overlay.querySelector("#manageNewCatInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); overlay.querySelector("#manageAddCatBtn").click(); }
  });

  function closeModal() {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  }
}

/* ---------- import / export ---------- */

function exportJSON() {
  const payload = {
    app: "mes-sous",
    exportedAt: new Date().toISOString(),
    categories,
    expenses,
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
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.expenses)) throw new Error("Format invalide");

      const replace = confirm(
        "Importer ce fichier :\nOK = remplacer toutes les données actuelles\nAnnuler = fusionner avec les données existantes"
      );

      if (Array.isArray(data.categories)) {
        if (replace) {
          categories = data.categories;
        } else {
          data.categories.forEach(c => {
            if (!categories.find(existing => existing.id === c.id)) categories.push(c);
          });
        }
        saveCategories();
      }

      if (replace) {
        expenses = data.expenses;
      } else {
        const existingIds = new Set(expenses.map(x => x.id));
        data.expenses.forEach(x => {
          if (!existingIds.has(x.id)) expenses.push(x);
          else expenses.push({ ...x, id: uid() });
        });
      }
      saveExpenses();

      renderCategorySelect();
      renderExpenses();
      updateMonthTotal();
      showToast("Import réussi ✅");
    } catch (err) {
      showToast("Fichier JSON invalide");
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
}
