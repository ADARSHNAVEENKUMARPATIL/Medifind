// Global XSS Sanitization Helper
window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Core local fallback storage helper
const PharmaDB = {
    getStoreConfig: () => JSON.parse(localStorage.getItem("ps_store_config")) || {
        id: 1,
        name: "MediFind Central Pharmacy",
        location: "Building A, Floor 3"
    },
    getActiveUser: () => JSON.parse(localStorage.getItem("ps_active_user")) || {
        name: "Adarsh Kumar",
        role: "Chief Pharmacist",
        initials: "AK",
        level: "Admin Level 4"
    }
};

// ===================================================================
// CYBERSECURITY: LOCAL FILE PROTOCOL EXECUTION BLOCKER (Problem 2)
// ===================================================================
if (window.location.protocol === 'file:') {
    window.stop(); // Stop all network loading and DOM parsing immediately
    document.write(`
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background-color: #111716;
            color: #edf2f0;
            font-family: 'Inter', sans-serif;
            text-align: center;
            padding: 20px;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            z-index: 999999;
        ">
            <div style="font-size: 80px; color: #ba1a1a; margin-bottom: 24px;">⚠️</div>
            <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 12px; color: #ffdad6; letter-spacing: -0.5px;">Local Execution Denied</h1>
            <p style="font-size: 14px; max-width: 520px; color: #dee4e1; line-height: 1.6; margin-bottom: 28px;">
                MediFind Clinical OS must be accessed via an authorized secure server node. Directly opening static files using the explorer (<code>file://</code>) is blocked for cybersecurity safety and database sync compliance.
            </p>
            <div style="background: rgba(186, 26, 26, 0.15); border: 1px solid rgba(186, 26, 26, 0.3); padding: 16px 28px; border-radius: 10px; margin-bottom: 28px; font-family: monospace; font-size: 14px; color: #4edea3; font-weight: bold; letter-spacing: 1px; display: inline-block;">
                npm start
            </div>
            <p style="font-size: 12px; color: #bcc9c6;">
                Please run the proper startup command inside your terminal, and navigate to <a href="http://localhost:5000" style="color: #4edea3; text-decoration: underline; font-weight: 600;">http://localhost:5000</a>.
            </p>
        </div>
    `);
    throw new Error("Local file protocol execution terminated by Security Engine.");
}

// Global page session security guard
document.addEventListener("DOMContentLoaded", () => {
    const isAuthPage = window.location.pathname.includes("login.html") || 
                       window.location.pathname.includes("register.html") || 
                       window.location.pathname.includes("welcome.html") || 
                       window.location.pathname.endsWith("/") ||
                       window.location.pathname.includes("index.html");
                       
    if (!isAuthPage) {
        const user = localStorage.getItem("ps_active_user");
        if (!user) {
            window.location.href = "login.html";
        }
    }
});

// Theme Management
function initTheme() {
    const isDark = localStorage.getItem("ps_theme") === "dark";
    if (isDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
    } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
    }
}

function toggleTheme() {
    const htmlEl = document.documentElement;
    if (htmlEl.classList.contains("dark")) {
        htmlEl.classList.remove("dark");
        htmlEl.classList.add("light");
        localStorage.setItem("ps_theme", "light");
    } else {
        htmlEl.classList.remove("light");
        htmlEl.classList.add("dark");
        localStorage.setItem("ps_theme", "dark");
    }
}

// Run initializations
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    
    // Inject Theme Toggle handler
    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
        themeBtn.addEventListener("click", toggleTheme);
    }

    // Dynamic Sidebar Info loading
    updateSidebarContent();
});

function updateSidebarContent() {
    const profileName = document.getElementById("sidebar-name");
    const profileRole = document.getElementById("sidebar-role");
    const profileAvatar = document.getElementById("sidebar-avatar");
    const nodeTitle = document.querySelector("aside h1 + p") || document.querySelector("aside h1");

    const user = PharmaDB.getActiveUser();
    const config = PharmaDB.getStoreConfig();

    if (profileName) profileName.textContent = user.name;
    if (profileRole) profileRole.textContent = user.role + " (" + user.level + ")";
    if (profileAvatar && user.initials) {
        profileAvatar.textContent = user.initials;
    }
}

// Toast helper
function showToast(message, isSuccess = true) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "fixed bottom-8 right-8 bg-[#1e2927] border border-outline-variant/30 text-white px-6 py-3 rounded-lg shadow-2xl translate-y-20 opacity-0 transition-all duration-300 flex items-center gap-3 z-[100]";
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `
        <span class="material-symbols-outlined" style="color: ${isSuccess ? '#6cf8bb' : '#ffdad6'}">
            ${isSuccess ? 'check_circle' : 'error'}
        </span>
        <span style="font-size: 13px; font-weight: 600;">${message}</span>
    `;
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
}
