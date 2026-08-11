/**
 * db/mysql.js — Sequelize ORM Connection
 *
 * MODULE FLOW:
 *  1. Read DB credentials from environment variables
 *  2. Create a Sequelize instance with connection pooling
 *  3. Export the instance so all models and routes can import it
 *  4. authenticate() is called once in server/index.js to verify the connection
 *
 * WHY SEQUELIZE:
 *  - Provides model-based query building — no raw SQL strings scattered in routes
 *  - Built-in sync() creates/alters tables automatically from model definitions
 *  - Connection pool (max:10) handles concurrent API requests efficiently
 *  - Supports transactions for multi-table writes (e.g., upload pipeline)
 */

const { Sequelize } = require("sequelize");

// ── Create Sequelize instance with mysql2 dialect ──────────────────────────
const sequelize = new Sequelize(
  process.env.DB_NAME, // database name
  process.env.DB_USER, // username
  process.env.DB_PASS, // password
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: "mysql",

    // ── Connection pool settings ───────────────────────────────────────────
    pool: {
      max: 10, // max simultaneous connections
      min: 0, // release idle connections back to pool
      acquire: 30000, // ms to wait before throwing "connection timeout"
      idle: 10000, // ms a connection can sit idle before being released
    },

    // ── Logging ───────────────────────────────────────────────────────────
    // Set to false in production to avoid SQL spam in logs
    logging: false, // set to console.log temporarily to debug queries

    // ── Sequelize options ─────────────────────────────────────────────────
    define: {
      underscored: false, // keep camelCase column names
      freezeTableName: true, // do not pluralize model names
      timestamps: true, // add createdAt / updatedAt automatically
    },

    dialectOptions: {
      // Allow GROUP BY queries without listing all columns (MySQL 5.7+ strict mode)
      // Required for aggregation queries in stats endpoints
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
  },
);

module.exports = sequelize;
