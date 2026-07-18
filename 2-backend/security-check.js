const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

console.log("\n=======================================================");
console.log("🛡️  MEDIFIND SYSTEM - BACKEND SECURITY VERIFICATION TEST");
console.log("=======================================================\n");

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;
let consoleLogs = "";

// Helper to make POST requests using native Node.js HTTP module
function postRequest(urlPath, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const options = {
            hostname: 'localhost',
            port: TEST_PORT,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                let json = {};
                try {
                    json = JSON.parse(body);
                } catch (e) {
                    json = { rawBody: body };
                }
                resolve({ statusCode: res.statusCode, body: json });
            });
        });

        req.on('error', (err) => reject(err));
        req.write(data);
        req.end();
    });
}

async function runTests() {
    // 1. Spawning Express Server on Test Port 5099
    console.log(`[INFO] Spawning MediFind Express server on port ${TEST_PORT}...`);
    serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        env: {
            ...process.env,
            PORT: TEST_PORT.toString(),
            DB_PASSWORD: 'your_secure_pgadmin_password' // Test environment password
        }
    });

    serverProcess.stdout.on('data', (data) => {
        const text = data.toString();
        consoleLogs += text;
        // Also print to master stdout for transparency
        process.stdout.write(`[Server Log] ${text}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error] ${data.toString()}`);
    });

    // Wait for server to boot up
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let passedAll = true;

    // ===================================================================
    // TEST 1: SECRETS INTEGRITY CHECK
    // ===================================================================
    console.log("\n-------------------------------------------------------");
    console.log("TEST 1: SECRETS INTEGRITY CHECK");
    console.log("-------------------------------------------------------");
    
    const hasConfigMsg = consoleLogs.includes("Environment Configurations Successfully Configured");
    const hasPasswordInCleartext = consoleLogs.includes("your_secure_pgadmin_password") || consoleLogs.includes("5834");

    if (hasConfigMsg && !hasPasswordInCleartext) {
        console.log("✅ SUCCESS: 'Environment Configurations Successfully Configured' printed.");
        console.log("✅ SUCCESS: Verified that console.logs do not output passwords in cleartext.");
    } else {
        passedAll = false;
        console.log("❌ FAILURE: Secrets Integrity Check failed.");
        console.log(`   - Setup message printed: ${hasConfigMsg}`);
        console.log(`   - Cleartext password exposed in logs: ${hasPasswordInCleartext}`);
    }

    // ===================================================================
    // TEST 2: RATE LIMIT TRIGGER
    // ===================================================================
    console.log("\n-------------------------------------------------------");
    console.log("TEST 2: RATE LIMIT TRIGGER");
    console.log("-------------------------------------------------------");
    console.log("[INFO] Simulating 6 consecutive login attempts within 10 seconds...");

    let responses = [];
    for (let i = 1; i <= 6; i++) {
        try {
            console.log(`   - Request #${i}...`);
            const res = await postRequest('/api/login', {
                email_address: "malicious_bot@attack.com",
                password: "IncorrectPassword123!"
            });
            responses.push(res);
        } catch (err) {
            console.error(`   ❌ Request #${i} failed to connect:`, err.message);
        }
        // Small delay between requests to simulate bot behavior
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (responses.length >= 6) {
        const statuses = responses.map(r => r.statusCode);
        console.log(`   [INFO] Status Codes received: ${JSON.stringify(statuses)}`);
        
        // Assert that the 6th request got HTTP 429 Dropped at Server Gateway
        const sixthResponse = responses[5];
        if (sixthResponse.statusCode === 429 && sixthResponse.body.message && sixthResponse.body.message.includes("Too Many Requests")) {
            console.log("✅ SUCCESS: 6th request dropped with HTTP Status 429!");
            console.log(`✅ SUCCESS: Received error payload: ${JSON.stringify(sixthResponse.body)}`);
        } else {
            passedAll = false;
            console.log("❌ FAILURE: 6th request was not rate-limited with HTTP 429.");
            console.log(`   - Got status code: ${sixthResponse.statusCode}`);
            console.log(`   - Got payload: ${JSON.stringify(sixthResponse.body)}`);
        }
    } else {
        passedAll = false;
        console.log("❌ FAILURE: Unable to complete all 6 requests.");
    }

    // ===================================================================
    // TEST 3: INPUT POLLUTION BLOCK
    // ===================================================================
    console.log("\n-------------------------------------------------------");
    console.log("TEST 3: INPUT POLLUTION BLOCK");
    console.log("-------------------------------------------------------");
    console.log("[INFO] Submitting corrupted payloads to '/api/medicines/add'...");

    // Payload A: Negative Quantity
    const payloadNegativeQty = {
        store_id: 1,
        pharmacist_id: 1,
        sku: "PH-TEST-01",
        quantity: -50,
        expiry_date: "2027-12-31"
    };

    // Payload B: SQL Injection Text Quantity
    const payloadSqlInjection = {
        store_id: 1,
        pharmacist_id: 1,
        sku: "PH-TEST-02",
        quantity: "DROP TABLE medicines;",
        expiry_date: "2027-12-31"
    };

    // Payload C: Expired Date / Legitimate string in the past
    const payloadExpiredDate = {
        store_id: 1,
        pharmacist_id: 1,
        sku: "PH-TEST-03",
        quantity: 100,
        expiry_date: "2020-01-01"
    };

    let passNegative = false;
    let passSqlInj = false;
    let passExpired = false;

    // Test A
    try {
        console.log("   - Submitting negative quantity payload...");
        const resA = await postRequest('/api/medicines/add', payloadNegativeQty);
        if (resA.statusCode === 400 && !resA.body.success) {
            console.log(`   ✅ Intercepted successfully (HTTP 400): ${JSON.stringify(resA.body)}`);
            passNegative = true;
        } else {
            console.log(`   ❌ Failed interception: Got HTTP ${resA.statusCode}`);
        }
    } catch (err) {
        console.error("   ❌ Failed A:", err.message);
    }

    // Test B
    try {
        console.log("   - Submitting SQL Injection text quantity payload...");
        const resB = await postRequest('/api/medicines/add', payloadSqlInjection);
        if (resB.statusCode === 400 && !resB.body.success) {
            console.log(`   ✅ Intercepted successfully (HTTP 400): ${JSON.stringify(resB.body)}`);
            passSqlInj = true;
        } else {
            console.log(`   ❌ Failed interception: Got HTTP ${resB.statusCode}`);
        }
    } catch (err) {
        console.error("   ❌ Failed B:", err.message);
    }

    // Test C
    try {
        console.log("   - Submitting expired date payload...");
        const resC = await postRequest('/api/medicines/add', payloadExpiredDate);
        if (resC.statusCode === 400 && !resC.body.success) {
            console.log(`   ✅ Intercepted successfully (HTTP 400): ${JSON.stringify(resC.body)}`);
            passExpired = true;
        } else {
            console.log(`   ❌ Failed interception: Got HTTP ${resC.statusCode}`);
        }
    } catch (err) {
        console.error("   ❌ Failed C:", err.message);
    }

    if (passNegative && passSqlInj && passExpired) {
        console.log("✅ SUCCESS: All polluted input payloads blocked at server gate with HTTP 400!");
    } else {
        passedAll = false;
        console.log("❌ FAILURE: Some polluted input payloads were not correctly blocked.");
    }

    // Clean shutdown of the test server
    console.log("\n-------------------------------------------------------");
    console.log("[INFO] Shutting down verification server...");
    serverProcess.kill('SIGINT');
    
    console.log("\n=======================================================");
    if (passedAll) {
        console.log("🏆 STATUS: ALL BACKEND SECURITY CHECKS PASSED SUCCESSFULLY!");
    } else {
        console.log("⚠️  STATUS: BACKEND SECURITY VERIFICATION COMPLETED WITH FAILURES.");
    }
    console.log("=======================================================\n");

    process.exit(passedAll ? 0 : 1);
}

runTests().catch(err => {
    console.error("Fatal Error running test suite:", err);
    if (serverProcess) serverProcess.kill();
    process.exit(1);
});
