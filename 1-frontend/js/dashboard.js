// MediFind Dashboard Metrics Fetch & KPI Update Controller

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardMetrics();
    // Refresh dashboard stats every 30 seconds
    setInterval(loadDashboardMetrics, 30000);
});

function loadDashboardMetrics() {
    const storeConfig = PharmaDB.getStoreConfig();
    const storeId = storeConfig.id || 1;

    fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            updateKPICards(data.metrics);
            updateAuditLogsTable(data.metrics.logs);
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Connection failure while loading dashboard telemetry.", false);
    });
}

function updateKPICards(metrics) {
    const totalMedsEl = document.getElementById("metricTotalMedicines");
    const expiredEl = document.getElementById("metricExpiredAlerts");
    const lowStockEl = document.getElementById("metricLowStockAlerts");
    const coldChainEl = document.getElementById("metricColdChainActive");

    if (totalMedsEl) totalMedsEl.textContent = metrics.totalMedicines.toLocaleString();
    if (expiredEl) expiredEl.textContent = metrics.expiredAlerts.toLocaleString();
    if (lowStockEl) lowStockEl.textContent = metrics.lowStockAlerts.toLocaleString();
    if (coldChainEl) coldChainEl.textContent = metrics.coldChainActive.toLocaleString();

    // Pulse effects on alerts if above zero
    if (expiredEl) {
        if (metrics.expiredAlerts > 0) {
            expiredEl.parentElement.parentElement.classList.add("border-red-500/30", "bg-red-500/5");
        } else {
            expiredEl.parentElement.parentElement.classList.remove("border-red-500/30", "bg-red-500/5");
        }
    }
    
    if (lowStockEl) {
        if (metrics.lowStockAlerts > 0) {
            lowStockEl.parentElement.parentElement.classList.add("border-amber-500/30", "bg-amber-500/5");
        } else {
            lowStockEl.parentElement.parentElement.classList.remove("border-amber-500/30", "bg-amber-500/5");
        }
    }
}

function updateAuditLogsTable(logs) {
    const logsBody = document.getElementById("dashboard-logs-body");
    if (!logsBody) return;
    logsBody.innerHTML = "";

    if (logs.length === 0) {
        logsBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-xs text-outline italic">No clinical transactions logged for this storefront.</td>
            </tr>`;
        return;
    }

    logs.forEach(log => {
        const row = document.createElement("tr");
        row.className = "hover:bg-primary/5 transition-colors border-b border-outline-variant/10 animate-fade-in-up";
        
        let qtyClass = "text-primary dark:text-[#6cf8bb] font-bold";
        if (log.qty.startsWith("-")) {
            qtyClass = "text-red-500 font-bold dark:text-red-400";
        } else if (log.qty.startsWith("+")) {
            qtyClass = "text-secondary font-bold dark:text-[#6cf8bb]";
        }

        row.innerHTML = `
            <td class="px-6 py-4 font-mono text-[11px] text-outline">${escapeHTML(log.time)}</td>
            <td class="px-6 py-4 font-bold text-slate-800 dark:text-white font-sans">${escapeHTML(log.name)}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    log.type === 'Inbound' ? 'bg-secondary-container/20 text-[#006c49]' : 'bg-red-100 text-red-700'
                }">${escapeHTML(log.type)}</span>
            </td>
            <td class="px-6 py-4 text-right font-mono ${qtyClass}">${escapeHTML(log.qty)}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold flex items-center justify-center dark:bg-primary/30 dark:text-[#6cf8bb]">${escapeHTML(log.opInitials)}</div>
                    <span class="text-xs text-slate-700 dark:text-white font-medium">${escapeHTML(log.operator)}</span>
                </div>
            </td>
        `;
        logsBody.appendChild(row);
    });
}
