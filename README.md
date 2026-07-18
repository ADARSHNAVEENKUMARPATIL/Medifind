# MediFind Clinical OS 🚀
> **Secure Multi-Store Clinical Pharmacy & Inventory Management System**

MediFind Clinical OS is a high-fidelity, secure, and robust web application designed for clinical pharmacies to manage, track, and audit medication inventories. Implemented with a multi-tenant design, it connects pharmacists with their respective stores and provides deep insight into stock levels, expiry countdowns, storage coordinates, and transaction logs.

---

## 🌟 Key Features

### 1. Multi-Tenant Pharmacist Operations
* **Store-Pharmacist Registration:** Secure registration bound to specific stores using Drug License Numbers and Pharmacist Registration Numbers.
* **Role & Privilege Guards:** Automated frontend validation requiring authorized session state to access clinical screens.

### 2. Precise Spatial Tracking
* **3D Coordinate Indexing:** Map every item to a specific `Rack`, `Shelf`, and `Box` location.
* **Collision Detection:** Automatic server-side verification to prevent allocating multiple medicines to the exact same coordinates.

### 3. Batch-Based Inventory Ledger
* **FIFO & Expiry Tracking:** Manage distinct batches of the same medicine to prevent dispensing expired products.
* **Urgent Alert Notifications:** Automated warning dashboard classifying medication status as **Optimal**, **Stable**, **Low Stock**, or **Expired/Expiring**.
* **Intelligent Ledger Filters:** Query and filter stock by critical levels, cold storage configuration, or short expiry (within 30 days).

### 4. Streamlined Stock Management
* **Inbound (Intake) System:** Rapidly register new batches with an automatic registration feature for unregistered medications on the fly.
* **Outtake (Dispatch/Quarantine) System:** Track stock decrements with explicit reason mapping (e.g., clearance, damage, expiration).
* **Automated Restocking:** One-click reordering based on safety stock par limits (1.5x par threshold).

---

## 🛡️ Cyber-Security & Hardening

Security is at the core of MediFind Clinical OS. It features multi-layer hardening implemented at the network, server, database, and client layers:

* **Local Protocol Execution Blocker:** A custom script prevents opening front-end static files using the insecure `file://` protocol. The application enforces serving files exclusively over an authorized server node (e.g., HTTP).
* **API Rate Limiter:** Protects endpoint authentication against brute-force and credential-stuffing attacks by restricting login attempts (drops the 6th consecutive attempt with a `429 Too Many Requests` error).
* **Input Pollution & Injection Filters:** Strict server-side validation blocks SQL injections, negative quantities, negative prices, or past dates at the API gateway level.

## ⚙️ Installation & Setup

### 1. Prerequisites
* Node.js (v16+)
* PostgreSQL Database (Local server or Cloud hosted like Neon/Aiven)

### 2. Database Initialization
Execute the SQL files inside the `3-database/` folder to spin up the database structure and load default test data:
```bash
# Connect to your Postgres instance and run:
psql -U postgres -d your_database -f 3-database/schema.sql
psql -U postgres -d your_database -f 3-database/seed.sql
```

### 3. Environment Configurations
Create a `.env` file in the root workspace directory (same level as `medifind-system`) and specify your configurations:
```env
PORT=5000
DB_USER=your_postgres_user
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=medifind_db
DB_PASSWORD=your_secure_password

# OR use a cloud connection string:
# DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

### 4. Running the Project
Navigate to the backend server and start the application:
```bash
cd medifind-system/2-backend
npm install
npm run dev
```

The system will automatically run on **`http://localhost:5000`** and serve the static frontend interface from `1-frontend/`.

---

## 🧪 Security & Verification Testing
The backend includes a security check script to evaluate rate limiters, input validation, and secrets protection:
```bash
cd medifind-system/2-backend
node security-check.js
```
Expected output: `🏆 STATUS: ALL BACKEND SECURITY CHECKS PASSED SUCCESSFULLY!`
* **Strict Security Headers:** Node server disables `x-powered-by` to prevent server fingerprinting and injects headers like `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `X-XSS-Protection`.
* **Atomic DB Transactions:** Utilizes SQL transaction isolation (`BEGIN`, `COMMIT`, `ROLLBACK`) for processes like intake and outtake to prevent data leakage and race conditions.
* **XSS Sanitization Helper:** Sanitizes user inputs in the UI before injecting contents into the DOM.
