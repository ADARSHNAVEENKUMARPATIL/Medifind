// MediFind Master Ledger & Active Expiry Matrix Logic

let activeMedicines = [];
let currentLedgerFilter = "All";
let sortColumn = "name";
let sortAsc = true;
let selectedSku = null;

document.addEventListener("DOMContentLoaded", () => {
    loadLedger();

    // Filters tab button handlers
    document.querySelectorAll(".ledger-filter").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".ledger-filter").forEach(b => {
                b.className = "ledger-filter bg-surface hover:bg-slate-100 border border-outline-variant/30 text-outline font-bold px-3.5 py-1.5 rounded-lg text-[10px] uppercase transition-all dark:bg-white/5 dark:hover:bg-white/10";
            });
            btn.className = "ledger-filter bg-primary text-white font-bold px-3.5 py-1.5 rounded-lg text-[10px] uppercase transition-all shadow-sm";
            currentLedgerFilter = btn.getAttribute("data-filter");
            renderLedgerTable();
        });
    });

    // Sort trigger binders
    const nameCol = document.getElementById("sort-name");
    if (nameCol) nameCol.addEventListener("click", () => triggerSort("name"));
    const qtyCol = document.getElementById("sort-qty");
    if (qtyCol) qtyCol.addEventListener("click", () => triggerSort("qty"));
    const expiryCol = document.getElementById("sort-expiry");
    if (expiryCol) expiryCol.addEventListener("click", () => triggerSort("expiry"));

    // Drawer bindings
    const closeDrawerBtn = document.getElementById("closeDrawerBtn");
    if (closeDrawerBtn) closeDrawerBtn.addEventListener("click", hideDrawer);
    
    const disposeBtn = document.getElementById("drawerDisposeBtn");
    if (disposeBtn) disposeBtn.addEventListener("click", triggerExpiredDisposal);
});

function loadLedger() {
    const storeConfig = PharmaDB.getStoreConfig();
    const storeId = storeConfig.id || 1;

    fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            activeMedicines = data.medicines;
            renderLedgerTable();
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Connection error while loading ledger data.", false);
    });
}

function renderLedgerTable() {
    const meds = [...activeMedicines];
    const tableBody = document.getElementById("ledger-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    // Sort medicines array
    meds.sort((a, b) => {
        let comparison = 0;
        
        if (sortColumn === "name") {
            comparison = a.name.localeCompare(b.name);
        } else if (sortColumn === "qty") {
            comparison = a.qty - b.qty;
        } else if (sortColumn === "expiry") {
            const daysA = calculateDaysRemaining(a.expiry_date || "2026-10-15");
            const daysB = calculateDaysRemaining(b.expiry_date || "2026-10-15");
            comparison = daysA - daysB;
        }
        
        return sortAsc ? comparison : -comparison;
    });

    // Render medicines matching filter
    let renderedCount = 0;
    
    meds.forEach(med => {
        if (med.qty <= 0) return;
        
        const medExpiryDateStr = med.expiryDate || (med.expiry_date ? med.expiry_date.split('T')[0] : "2026-12-31");
        const daysRemaining = calculateDaysRemaining(medExpiryDateStr);
        const isCritical = med.qty <= med.par * 0.2 || daysRemaining <= 0;
        const isExpiry = daysRemaining <= 30;
        const isCold = med.coldStorage ? true : false;

        let matchesFilter = true;
        if (currentLedgerFilter === "Critical") matchesFilter = isCritical;
        else if (currentLedgerFilter === "Expiry") matchesFilter = isExpiry;
        else if (currentLedgerFilter === "Cold") matchesFilter = isCold;

        if (!matchesFilter) return;
        renderedCount++;

        const row = document.createElement("tr");
        row.className = "hover:bg-primary/5 cursor-pointer transition-colors group zebra-stripe border-b border-outline-variant/10 animate-fade-in-up";
        
        const safeName = escapeHTML(med.name.replace(/'/g, "\\'"));
        const safeSku = escapeHTML(med.sku.replace(/'/g, "\\'"));
        const safeRack = escapeHTML(med.rack.replace(/'/g, "\\'"));
        const safeShelf = escapeHTML(med.shelf.replace(/'/g, "\\'"));
        const safeBox = escapeHTML(med.box.replace(/'/g, "\\'"));
        row.setAttribute("onclick", `showDrawer('${safeSku}', '${safeName}', ${med.qty}, ${med.par}, '${safeRack}', '${safeShelf}', '${safeBox}', ${daysRemaining})`);

        // Badges config
        let qtyClass = "text-primary dark:text-[#6cf8bb]";
        let statusBadge = "bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#6cf8bb] font-bold";
        let statusLabel = "Stable";
        
        if (med.qty <= med.par * 0.2) {
            qtyClass = "text-red-600 dark:text-red-400 font-bold";
            statusBadge = "bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400 font-bold";
            statusLabel = "Critical";
        } else if (med.qty <= med.par * 0.5) {
            qtyClass = "text-amber-600 dark:text-amber-500 font-bold";
            statusBadge = "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 font-bold";
            statusLabel = "Low Stock";
        } else if (med.qty >= med.par * 0.9) {
            statusLabel = "Optimal";
        }

        let countdownLabel = "";
        let countdownColor = "text-slate-700 dark:text-[#dee4e1]";
        
        if (daysRemaining <= 0) {
            countdownLabel = "EXPIRED";
            countdownColor = "text-red-600 font-black animate-pulse dark:text-red-400";
        } else if (daysRemaining <= 30) {
            countdownLabel = `${daysRemaining} Days Left`;
            countdownColor = "text-amber-600 font-black animate-pulse dark:text-amber-400";
        } else {
            countdownLabel = `${daysRemaining} Days`;
        }

        row.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-800 dark:text-white font-sans">
                <div>${escapeHTML(med.name)}</div>
                <div class="text-[10px] font-mono text-outline uppercase tracking-wider font-semibold mt-0.5">${escapeHTML(med.sku)}</div>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center text-[10px] font-mono text-primary font-black dark:text-[#6cf8bb]">
                    <span class="px-1.5 py-0.5 bg-surface-container dark:bg-white/5 border rounded mr-1">${escapeHTML(med.rack).replace("RACK ", "R-")}</span>
                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                    <span class="px-1.5 py-0.5 bg-surface-container dark:bg-white/5 border rounded mx-1">${escapeHTML(med.shelf).replace("SHELF ", "SH-")}</span>
                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                    <span class="px-1.5 py-0.5 bg-surface-container dark:bg-white/5 border rounded ml-1">${escapeHTML(med.box).replace("BOX ", "BX-")}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="${qtyClass} font-black font-mono">${med.qty.toLocaleString()}</div>
                <div class="text-[9px] text-outline mt-0.5">Par: ${med.par}</div>
            </td>
            <td class="px-6 py-4">
                <div class="font-mono font-bold">${medExpiryDateStr}</div>
                <div class="text-[9px] font-bold ${countdownColor}">${countdownLabel}</div>
            </td>
            <td class="px-6 py-4">
                <span class="${statusBadge} px-2.5 py-0.5 rounded text-[9px] uppercase tracking-wider">${statusLabel}</span>
            </td>
        `;
        tableBody.appendChild(row);
    });

    const pagText = document.getElementById("tablePaginationText");
    if (pagText) pagText.textContent = `Showing ${renderedCount} of ${activeMedicines.length} localized medicine templates`;
}

function calculateDaysRemaining(dateStr) {
    const expiry = new Date(dateStr);
    const today = new Date();
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function triggerSort(col) {
    if (sortColumn === col) {
        sortAsc = !sortAsc;
    } else {
        sortColumn = col;
        sortAsc = true;
    }
    renderLedgerTable();
}

window.showDrawer = function(sku, name, qty, par, rack, shelf, box, daysRemaining) {
    selectedSku = sku;
    
    document.getElementById("drawerMedTitle").textContent = name;
    document.getElementById("drawerSku").textContent = `SKU: ` + sku;
    document.getElementById("drawerCurrentQty").textContent = qty;
    document.getElementById("drawerParQty").textContent = par;
    
    document.getElementById("drawerRack").textContent = rack;
    document.getElementById("drawerShelf").textContent = shelf;
    document.getElementById("drawerBox").textContent = box;

    const pct = Math.min(Math.round((qty / par) * 100), 100);
    document.getElementById("drawerQtyPct").textContent = `${pct}%`;
    
    const progressBar = document.getElementById("drawerProgressBar");
    progressBar.style.width = `${pct}%`;
    
    if (pct <= 20) {
        progressBar.className = "h-full bg-red-600";
    } else if (pct <= 50) {
        progressBar.className = "h-full bg-amber-500";
    } else {
        progressBar.className = "h-full bg-primary";
    }

    const alertCard = document.getElementById("drawerExpiryAlertCard");
    const alertIcon = document.getElementById("drawerExpiryIcon");
    const alertDays = document.getElementById("drawerExpiryDays");
    const alertText = document.getElementById("drawerExpiryText");
    const disposalBox = document.getElementById("drawerDisposalBox");
    const footer = document.getElementById("drawerFooter");

    if (qty <= 0) {
        // Treated as stockout!
        alertCard.className = "bg-red-50 dark:bg-red-950/20 border border-red-500/20 rounded-xl p-4 shadow-sm flex items-start gap-3 border-l-4 border-l-red-500";
        alertIcon.className = "material-symbols-outlined text-red-600 dark:text-red-400 text-lg";
        alertIcon.textContent = "error";
        alertDays.className = "text-sm font-black text-red-600 dark:text-red-400 mt-0.5";
        alertDays.textContent = "STOCKOUT";
        alertText.textContent = "Critical alert! No active stock remains in store allocation.";
        if (disposalBox) disposalBox.classList.add("hidden");
        if (footer) footer.classList.add("hidden");
    } else if (daysRemaining <= 0) {
        alertCard.className = "bg-red-50 dark:bg-red-950/20 border border-red-500/20 rounded-xl p-4 shadow-sm flex items-start gap-3 animate-bounce";
        alertIcon.className = "material-symbols-outlined text-red-600 dark:text-red-400 text-lg";
        alertIcon.textContent = "error";
        alertDays.className = "text-sm font-black text-red-600 dark:text-red-400 mt-0.5";
        alertDays.textContent = "BATCH EXPIRED";
        alertText.textContent = "Quarantine stock immediately! Process standard disposal audit.";
        if (disposalBox) disposalBox.classList.remove("hidden");
        if (footer) footer.classList.remove("hidden");
    } else if (daysRemaining <= 30) {
        alertCard.className = "bg-amber-50 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 shadow-sm flex items-start gap-3 animate-pulse";
        alertIcon.className = "material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg";
        alertIcon.textContent = "warning";
        alertDays.className = "text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5";
        alertDays.textContent = `${daysRemaining} Days Left`;
        alertText.textContent = "Approaching threshold limit. Enforce FIFO immediate stock rotation.";
        if (disposalBox) disposalBox.classList.add("hidden");
        if (footer) footer.classList.add("hidden");
    } else {
        alertCard.className = "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 shadow-sm flex items-start gap-3";
        alertIcon.className = "material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg";
        alertIcon.textContent = "check_circle";
        alertDays.className = "text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5";
        alertDays.textContent = `${daysRemaining} Days Left`;
        alertText.textContent = "Healthy shelf life. Standard room climate conditions validated.";
        if (disposalBox) disposalBox.classList.add("hidden");
        if (footer) footer.classList.add("hidden");
    }

    document.getElementById("detailsDrawer").classList.remove("translate-x-full");
};

function hideDrawer() {
    const drawer = document.getElementById("detailsDrawer");
    if (drawer) drawer.classList.add("translate-x-full");
}

function triggerExpiredDisposal() {
    const storeConfig = PharmaDB.getStoreConfig();
    const storeId = storeConfig.id || 1;
    const activeUser = PharmaDB.getActiveUser();

    fetch('/api/ledger/dispose-expired', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sku: selectedSku,
            store_id: storeId,
            pharmacist_id: activeUser.id || 1
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || `Disposed expired batches successfully!`);
            loadLedger();
            hideDrawer();
        } else {
            showToast(data.message || "Failed to dispose expired stock.", false);
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Connection error while processing disposal request.", false);
    });
}
