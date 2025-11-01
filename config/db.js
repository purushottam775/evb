// config/db.js
import dotenv from "dotenv";
dotenv.config(); // load env first

import mysql from "mysql2";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ev",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: 0,
});

// Quick warmup check (acquire & release one connection)
pool.getConnection((err, conn) => {
  if (err) {
    console.error("MySQL pool connection failed:", err.message);
    process.exit(1);
  }
  if (conn) conn.release();
  console.log("MySQL pool initialized");
});

// Graceful shutdown on SIGINT
process.on("SIGINT", () => {
  pool.end((err) => {
    if (err) console.error("Error closing MySQL pool:", err);
    else console.log("MySQL pool closed");
    process.exit(err ? 1 : 0);
  });
});

export default pool;
