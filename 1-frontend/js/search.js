// MediFind Medicine Search & Coordinate Shelf Locator Logic

let currentFilter = "All";

document.addEventListener("DOMContentLoaded", () => {
    // Read URL search params for quick dashboard finds
    const params = new URLSearchParams(window.location.search);
    const queryParam = params.get("query");
    if (queryParam) {
        const searchInput = document.getElementById("medicineSearch");
        if (searchInput) searchInput.value = queryParam;
    }

    loadMedicines();

    // Dynamic search inputs trigger
    const searchInput = document.getElementById("medicineSearch");
    if (searchInput) {
        searchInput.addEventListener("input", loadMedicines);
    }
    
    // Category Chips tabs triggers
    document.querySelectorAll(".chip-filter").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".chip-filter").forEach(c => {
                c.className = "chip-filter px-3 py-1 bg-white dark:bg-white/5 border border-outline-variant/30 hover:bg-slate-50 dark:hover:bg-white/10 rounded-full text-[10px] uppercase font-bold text-outline transition-all";
            });
            
            chip.className = "chip-filter px-3 py-1 bg-primary text-white font-bold rounded-full text-[10px] uppercase transition-all shadow-sm";
            currentFilter = chip.getAttribute("data-category");
            loadMedicines();
        });
    });

    // Close Modal bindings
    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", hideMapModal);
    }
    const mapModal = document.getElementById("mapModal");
    if (mapModal) {
        mapModal.addEventListener("click", (e) => {
            if (e.target === mapModal) hideMapModal();
        });
    }
});

function loadMedicines() {
    const storeConfig = PharmaDB.getStoreConfig();
    const storeId = storeConfig.id || 1;
    const searchInput = document.getElementById("medicineSearch");
    const queryVal = searchInput ? searchInput.value.trim() : "";

    fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, query: queryVal })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            let meds = data.medicines;
            const grid = document.getElementById("resultsGrid");
            if (!grid) return;
            grid.innerHTML = "";

            // Filter client side by Category chips
            if (currentFilter !== "All") {
                meds = meds.filter(m => m.category === currentFilter);
            }

            if (meds.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full py-12 text-center text-xs text-outline italic">
                        No registered medicines matching the search parameters were found in your ward catalog.
                    </div>`;
                return;
            }

            meds.forEach(med => {
                const card = document.createElement("div");
                card.className = "med-card bg-white dark:bg-[#151c1b] border border-outline-variant/30 rounded-xl p-5 hover-lift flex flex-col justify-between h-[230px] shadow-sm group animate-fade-in-up";
                card.setAttribute("data-name", med.name.toLowerCase());
                card.setAttribute("data-sku", med.sku.toLowerCase());
                card.setAttribute("data-category", med.category);
                
                let quantityColor = "text-primary dark:text-[#6cf8bb]";
                let statusChip = "bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#6cf8bb]";
                
                if (med.qty <= med.par * 0.2) {
                    quantityColor = "text-red-600 dark:text-red-400 font-bold";
                    statusChip = "bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400 font-bold";
                } else if (med.qty <= med.par * 0.5) {
                    quantityColor = "text-amber-600 dark:text-amber-500 font-bold";
                    statusChip = "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 font-bold";
                }

                const isCold = med.coldStorage ? true : false;
                const safeName = escapeHTML(med.name.replace(/'/g, "\\'"));
                const safeRack = escapeHTML(med.rack.replace(/'/g, "\\'"));
                const safeShelf = escapeHTML(med.shelf.replace(/'/g, "\\'"));
                const safeBox = escapeHTML(med.box.replace(/'/g, "\\'"));

                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <span class="${statusChip} px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">${escapeHTML(med.category)}</span>
                            <div class="flex flex-col items-end">
                                <span class="${quantityColor} font-black font-mono text-base leading-none">${med.qty}</span>
                                <span class="text-[9px] text-outline uppercase font-semibold mt-0.5">Units</span>
                            </div>
                        </div>
                        <h3 class="text-sm font-bold font-headline-md text-slate-800 group-hover:text-primary dark:text-white dark:group-hover:text-[#6cf8bb] transition-colors leading-snug">${escapeHTML(med.name)}</h3>
                        <p class="font-mono text-[10px] text-outline mt-1 font-semibold uppercase">SKU: ${escapeHTML(med.sku)}</p>
                    </div>

                    <div class="space-y-3">
                        <div class="bg-surface dark:bg-white/5 rounded-lg p-2.5 flex items-center justify-between text-center gap-1.5 shadow-inner border border-outline-variant/20">
                            <div class="flex-1">
                                <p class="text-[8px] text-outline uppercase font-bold tracking-wider">Rack</p>
                                <p class="font-mono text-xs font-black text-slate-700 dark:text-white">${escapeHTML(med.rack)}</p>
                            </div>
                            <div class="w-px h-5 bg-outline-variant/30"></div>
                            <div class="flex-1">
                                <p class="text-[8px] text-outline uppercase font-bold tracking-wider">Shelf</p>
                                <p class="font-mono text-xs font-black text-slate-700 dark:text-white">${escapeHTML(med.shelf)}</p>
                            </div>
                            <div class="w-px h-5 bg-outline-variant/30"></div>
                            <div class="flex-1">
                                <p class="text-[8px] text-outline uppercase font-bold tracking-wider">Box</p>
                                <p class="font-mono text-xs font-black text-slate-700 dark:text-white">${escapeHTML(med.box)}</p>
                            </div>
                        </div>

                        <button onclick="showMap('${safeName}', '${safeRack}', '${safeShelf}', '${safeBox}', ${isCold})" class="w-full py-1.5 border border-primary text-primary dark:border-[#6cf8bb] dark:text-[#6cf8bb] font-bold rounded-lg hover:bg-primary/5 active:scale-[0.98] transition-all text-[10px] uppercase tracking-wider flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-sm">near_me</span>
                            Locate Shelf Map
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Connection error while loading medicines catalog.", false);
    });
}

// Visual Shelf Map Modal Highlight
window.showMap = function(medName, rack, shelf, box, isCold) {
    const modal = document.getElementById("mapModal");
    if (!modal) return;
    const inner = modal.querySelector(".scale-95") || modal.querySelector(".transform");
    
    document.getElementById("modalMedTitle").textContent = medName;
    document.getElementById("modalCoordinates").textContent = `${rack} • ${shelf} • ${box}`;
    document.getElementById("targetLocationBadge").textContent = rack;

    // Route directions path texts
    const aisleNum = rack.includes("RACK") ? parseInt(rack.replace("RACK ", "")) : `COLD CHAIN`;
    document.getElementById("pathAisle").textContent = `AISLE ` + (isNaN(aisleNum) ? '1' : aisleNum);
    document.getElementById("pathRack").textContent = rack;
    document.getElementById("pathShelfBox").textContent = `${shelf}, ${box}`;

    // Temperature seal checks
    const tempEl = document.getElementById("tempRequirement");
    if (isCold) {
        tempEl.innerHTML = `<span class="text-blue-500 font-bold">FRIDGE COLD CHAIN REQUIRED (2-8°C). Keep sealed.</span>`;
    } else {
        tempEl.textContent = `Ambient Temperature Controlled Shelf.`;
    }

    // Highlighting cell mathematically mapping box number (1-12) to row (A, B, C) and continuous cell index
    const boxNumMatch = box.match(/\d+/);
    const boxNum = boxNumMatch ? parseInt(boxNumMatch[0]) : 1;

    let rowLetter = 'A';
    if (boxNum >= 5 && boxNum <= 8) rowLetter = 'B';
    else if (boxNum >= 9) rowLetter = 'C';

    const targetCellCode = `SHELF ${rowLetter}-${boxNum}`;


    document.querySelectorAll(".cell-map").forEach(cell => {
        const code = cell.getAttribute("data-cell");
        const cellLabel = code ? (code.match(/\d+/) ? code.match(/\d+/)[0] : "") : "";
        cell.textContent = cellLabel;

        if (code === targetCellCode) {
            cell.className = "cell-map bg-emerald-500 text-slate-900 border-2 border-emerald-300 rounded flex items-center justify-center font-mono text-[10px] font-black pulse-location z-10 dark:bg-[#6cf8bb] dark:border-[#6cf8bb] dark:text-slate-950";
        } else {
            cell.className = "cell-map bg-slate-800/40 dark:bg-white/5 rounded border border-slate-700/60 flex items-center justify-center font-mono text-[9px] font-bold text-slate-400 dark:text-slate-500";
        }
    });

    modal.classList.remove("hidden");
    setTimeout(() => {
        inner.classList.remove("scale-95", "opacity-0");
        inner.classList.add("scale-100", "opacity-100");
    }, 50);
};

function hideMapModal() {
    const modal = document.getElementById("mapModal");
    if (!modal) return;
    const inner = modal.querySelector(".scale-100") || modal.querySelector(".transform");

    inner.classList.remove("scale-100", "opacity-100");
    inner.classList.add("scale-95", "opacity-0");
    
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 250);
}
