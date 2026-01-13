import sqlite3 from "sqlite3";
import path from "path";

// Define file paths for separate databases
const tradesDbPath = path.join(process.cwd(), "trades.db");

// Initialize and export the trades database
export const tradesDb = new sqlite3.Database(
  tradesDbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error("[INIT] Could not connect to trades.db", err);
    } else {
      console.log("[INIT] Connected to trades.db");
      tradesDb.run(
        `
        CREATE TABLE IF NOT EXISTS trades (
          broker TEXT NOT NULL,
          accountId REAL NOT NULL,
          contractId TEXT NOT NULL,
          creationTimestamp TEXT NOT NULL,
          price REAL NOT NULL,
          profitAndLoss REAL,
          fees REAL NOT NULL,
          side TEXT NOT NULL,
          size REAL NOT NULL,
          orderId REAL NOT NULL,
          PRIMARY KEY(accountId, orderId, creationTimestamp)
        );
        `,
        (err) => {
          if (err) {
            console.error("[INIT] Failed to create trades table:", err.message);
          } else {
            console.log("[INIT] trades table ready");
          }
        }
      );
    }
  }
);

/**
 * Clears all data from the trades table
 */
export function clearTradesTable(): Promise<void> {
  return new Promise((resolve, reject) => {
    tradesDb.run("DELETE FROM trades;", (err) => {
      if (err) {
        console.error("[DB] Failed to clear trades table:", err.message);
        reject(err);
      } else {
        console.log("[DB] Trades table cleared successfully");
        resolve();
      }
    });
  });
}
