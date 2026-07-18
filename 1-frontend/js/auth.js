// MediFind Authentication Form Validations & Login Tracking

document.addEventListener("DOMContentLoaded", () => {
    // 1. Password Complexity Tracker
    const pwdInput = document.getElementById("password") || document.getElementById("loginPassword");
    if (pwdInput) {
        pwdInput.addEventListener("input", (e) => {
            const val = e.target.value;
            validatePasswordStrength(val);
        });
    }

    // 2. Register Form Submission Handler
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            handleRegister();
        });
    }
});

function validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const lengthIndicator = document.getElementById("param-length");
    const upperIndicator = document.getElementById("param-upper");
    const lowerIndicator = document.getElementById("param-lower");
    const numberIndicator = document.getElementById("param-number");
    const specialIndicator = document.getElementById("param-special");

    if (lengthIndicator) toggleParamClass(lengthIndicator, password.length >= minLength);
    if (upperIndicator) toggleParamClass(upperIndicator, hasUpper);
    if (lowerIndicator) toggleParamClass(lowerIndicator, hasLower);
    if (numberIndicator) toggleParamClass(numberIndicator, hasNumber);
    if (specialIndicator) toggleParamClass(specialIndicator, hasSpecial);
}

function toggleParamClass(el, isOk) {
    if (isOk) {
        el.classList.add("text-emerald-600", "dark:text-emerald-400", "font-bold");
        el.classList.remove("text-slate-400", "dark:text-outline-variant");
        el.querySelector("span").textContent = "check_circle";
    } else {
        el.classList.remove("text-emerald-600", "dark:text-emerald-400", "font-bold");
        el.classList.add("text-slate-400", "dark:text-outline-variant");
        el.querySelector("span").textContent = "radio_button_unchecked";
    }
}

function handleRegister() {
    const store_name = document.getElementById("storeName").value.trim();
    const drug_license_no = document.getElementById("licenceNo").value.trim();
    const store_address = document.getElementById("storeAddress").value.trim();
    const contact_number = document.getElementById("contactNo").value.trim();
    const pharmacist_reg_no = document.getElementById("regNo").value.trim();
    const full_name = document.getElementById("fullName").value.trim();
    const email_address = document.getElementById("emailAddress").value.trim();
    const password = document.getElementById("password").value;

    if (!store_name || !drug_license_no || !store_address || !contact_number ||
        !pharmacist_reg_no || !full_name || !email_address || !password) {
        showToast("All 8 onboarding parameters are strictly required.", false);
        return;
    }

    const payload = {
        store_name,
        drug_license_no,
        store_address,
        contact_number,
        pharmacist_reg_no,
        full_name,
        email_address,
        password
    };

    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast("Store Onboarded Successfully! Redirecting to login...");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1500);
        } else {
            showToast(data.message || "Registration failed. Verify parameter constraints.", false);
        }
    })
    .catch(err => {
        console.error(err);
        showToast("Onboarding node communication failure.", false);
    });
}
