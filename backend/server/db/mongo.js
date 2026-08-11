/**
 * db/mongo.js — Mongoose (MongoDB) Connection
 *
 * MODULE FLOW:
 *  1. connectMongo() is called once in server/index.js on startup
 *  2. Mongoose maintains a persistent connection — no per-request reconnect
 *  3. Rules are stored here as schema-free documents (no migrations needed)
 *  4. All rule CRUD routes import Mongoose models defined in models/Rule.js
 */

const mongoose = require("mongoose");

const connectMongo = async () => {
  try {
    // Remove deprecated options — not needed in Mongoose 7+ / Driver 4+
    // console.log(process.env.MONGO_URI);

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  MongoDB connected");
  } catch (err) {
    console.error("❌  MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️   MongoDB disconnected — retrying...");
});

module.exports = connectMongo;
