const { Pool } = require('pg');
require('dotenv').config();

// Assert environment connection details without logging cleartext passwords
const dbUser = process.env.DB_USER || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbDatabase = process.env.DB_DATABASE || 'medifind_db';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
const databaseUrl = process.env.DATABASE_URL;

console.log("Environment Configurations Successfully Configured");

// Configure the connection pool to support both direct configurations and single connection strings (e.g. from Render/Railway)
const pool = new Pool(
    databaseUrl
        ? {
              connectionString: databaseUrl,
              ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
          }
        : {
              user: dbUser,
              host: dbHost,
              database: dbDatabase,
              password: dbPassword,
              port: dbPort
          }
);

// Verify connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ PostgreSQL Connection Error:', err.message);
    } else {
        const connectedDb = databaseUrl ? 'Remote database via connection string' : dbDatabase;
        const connectedHost = databaseUrl ? 'Cloud' : dbHost;
        console.log(`⚡ PostgreSQL Connected Successfully to "${connectedDb}" on ${connectedHost}`);
    }
});

module.exports = pool;
