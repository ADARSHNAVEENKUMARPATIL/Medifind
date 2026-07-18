const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../2-backend/.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:@localhost:5432/medifind_db';

async function initializeDatabase() {
    console.log("⚙️ Initiating MediFind Database Provisioning Wizard...");
    console.log(`🔌 Target connection string: ${connectionString.replace(/:([^:@]+)@/, ':****@')}`);

    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("⚡ Connection established successfully!");

        // 1. Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        console.log(`📖 Loading DDL schema: ${schemaPath}`);
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        console.log("✅ DDL schema structures created successfully!");

        // 2. Read and execute seed data
        const seedPath = path.join(__dirname, 'seed.sql');
        console.log(`📖 Loading testing profiles seed: ${seedPath}`);
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await client.query(seedSql);
        console.log("✅ Seeding completed! Admin account provisioned: admin@medifind.com / Admin@123");

    } catch (err) {
        console.error("❌ Provisioning Wizard failed: ", err.message);
        console.log("\n💡 Make sure the target PostgreSQL database 'medifind_db' exists before running this. You can create it in pgAdmin or psql: CREATE DATABASE medifind_db;");
    } finally {
        await client.end();
        console.log("🚪 Closed seeder client connection.");
    }
}

initializeDatabase();
