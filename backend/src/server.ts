// Basic backend server for API integrations
// Run with: npx tsx backend/server.ts
import express, { Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";

//import KrakenClient from "kraken-api";
import cron from "node-cron";

// Import the database module
import { tradesDb, clearTradesTable } from "../logger/db";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Server start timestamp - used to track trades since server started
const serverStartTimestamp = new Date().toISOString();
console.log(`[INIT] Server start timestamp: ${serverStartTimestamp}`);

// Get the first day of the current month as ISO string
function getFirstDayOfCurrentMonth(): string {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return firstDay.toISOString();
}

// Track if initial sync has been performed
let initialSyncDone = false;

const app = express();
// Create HTTP server
const server = http.createServer(app);
// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Configure CORS to allow DELETE methods
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());

// Add middleware to parse text/plain as JSON for TradingView webhooks
app.use("/api/trade/tradingview", express.text({ type: "text/plain" }));
app.use("/api/trade/tradingview", (req, res, next) => {
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      // If parsing fails, leave as string
    }
  }
  next();
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TRADING VIEW
//
// TradingView Webhook Endpoint
app.post("/api/trade/tradingview", async (req: Request, res: Response) => {
  // Log the payload received from TradingView
  console.log("[TRADINGVIEW ALERT PAYLOAD]", req.body);
  try {
    interface TradingViewAlert {
      key: string;
      broker?: string;
      accountId?: number;
      contractId?: string;
      side?: string;
      quantity?: number;
      pair?: string;
      type?: string;
      ordertype?: string;
      volume?: number;
      price?: number;
    }
    const alert = req.body as TradingViewAlert;

    if (alert.key == "XCtCCAEw2G8Dg9") {
      const { broker } = alert;
      if (!broker) {
        return res
          .status(400)
          .json({ error: "Missing broker in TradingView alert" });
      }

      if (broker.toLowerCase() === "topstep") {
        const { contractId, side, quantity, price } = alert;
        if (!contractId || !side || !quantity || !price) {
          return res
            .status(400)
            .json({ error: "Missing required fields for Topstep trade" });
        }
        const orderPayload = {
          contractId: contractId,
          quantity: quantity,
          side: side === "buy" ? 0 : 1,
          type: 2,
          price: price,
        };
        console.log(`Placing Topstep order with payload:`, orderPayload);
        const axiosRes = await axios.post(
          `http://localhost:${PORT}/api/trade/topstep/order`,
          orderPayload
        );
        return res.json({
          success: true,
          broker: "topstep",
          orderResult: axiosRes.data,
        });
      } else if (broker.toLowerCase() === "kraken") {
        // Placeholder for Kraken integration
        return res.status(501).json({
          error:
            "Kraken trading from TradingView not implemented in this demo.",
        });
      } else if (broker.toLowerCase() === "ibkr") {
        // Placeholder for IBKR integration
        return res.status(501).json({
          error: "IBKR trading from TradingView not implemented in this demo.",
        });
      } else {
        return res
          .status(400)
          .json({ error: "Unknown broker in TradingView alert" });
      }
    } else {
      return res
        .status(400)
        .json({ error: "Invalid or missing key in TradingView alert" });
    }
  } catch (error) {
    const err = error as Error;
    res.status(400).json({
      error: "Failed to process TradingView alert",
      details: err.message,
    });
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TOPSTEP
//
// Topstep Trade Execution Endpoint
app.post("/api/trade/topstep/order", async (req: Request, res: Response) => {
  const { contractId, quantity, side, type } = req.body as {
    contractId: string;
    quantity: number;
    side: number;
    type: number;
  };

  try {
    const sessionToken = process.env.TOPSTEP_API_SESSION_TOKEN;
    const username = process.env.TOPSTEP_USERNAME;
    if (!sessionToken || !username) {
      return res.status(400).json({
        error:
          "TOPSTEP_API_KEY and TOPSTEP_USERNAME are required in .env.local",
      });
    }
    const url = "https://api.topstepx.com/api/Order/place";
    const payload = {
      accountId: process.env.TOPSTEP_ACCOUNT_ID,
      contractId: contractId,
      type: type,
      side: side,
      size: quantity,
      limitPrice: null,
      stopPrice: null,
      trailPrice: null,
      customTag: null,
      linkedOrderId: null,
    };

    const response = await axios.post(url, payload, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
    });
    res.json(response.data);

    // Print contractId, quantity, and side to terminal
    console.log(
      `[TOPSTEP TRADE] contractId: ${contractId}, quantity: ${quantity}, side: ${
        side === 0 ? "buy" : "sell"
      }`
    );

    // Sync trades immediately after placing a trade
    try {
      const accountId = process.env.TOPSTEP_ACCOUNT_ID;
      if (!sessionToken || !accountId) {
        console.error(
          "[SYNC] Missing session token or account ID for immediate trade sync"
        );
        return;
      }
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 minute ago
      const startTimestamp = oneMinuteAgo.toISOString();
      const endTimestamp = now.toISOString();
      const syncUrl = `https://api.topstepx.com/api/Trade/search`;
      const syncPayload = {
        accountId: parseInt(accountId),
        startTimestamp: startTimestamp,
        endTimestamp: endTimestamp,
      };
      const syncResponse = await axios.post(syncUrl, syncPayload, {
        headers: {
          accept: "text/plain",
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (
        syncResponse.data &&
        syncResponse.data.trades &&
        Array.isArray(syncResponse.data.trades)
      ) {
        const { inserted, skipped } = await logTopstepTradesToDatabase(
          syncResponse.data.trades
        );
        console.log(
          `[SYNC] Immediate sync: ${syncResponse.data.trades.length} trades, ${inserted} inserted, ${skipped} skipped (duplicates)`
        );
      }
    } catch (syncError) {
      console.error(
        "[SYNC] Failed to sync trades after order:",
        syncError instanceof Error ? syncError.message : String(syncError)
      );
    }
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      error: "Failed to execute Topstep trade",
      details: err.message,
    });
  }
});

// Topstep Contract Search Endpoint
app.post(
  "/api/trade/topstep/contractId",
  async (req: Request, res: Response) => {
    const { symbol } = req.body as { symbol: string };
    try {
      const sessionToken = process.env.TOPSTEP_API_SESSION_TOKEN;
      if (!sessionToken) {
        return res.status(400).json({
          error: "TOPSTEP_API_SESSION_TOKEN is required in .env.local",
        });
      }
      const url = "https://api.topstepx.com/api/Contract/search";
      const payload = { searchText: `${symbol}`, live: false };
      const response = await axios.post(url, payload, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });
      const responseJson = response.data;
      console.log(
        `Topstep contract search response for ${symbol}:`,
        responseJson
      );
      if (!responseJson.success) {
        return res.status(500).json({
          error: "API call failed",
          errorMessage: responseJson.errorMessage,
        });
      }
      interface TopstepContract {
        id: string;
        name: string;
        description: string;
        tickSize: number;
        tickValue: number;
        activeContract: boolean;
      }
      const contracts = (responseJson.contracts || [])
        .filter(
          (c: TopstepContract) => c.name.toUpperCase() === symbol.toUpperCase()
        )
        .map((c: TopstepContract) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          tickSize: c.tickSize,
          tickValue: c.tickValue,
          activeContract: c.activeContract,
        }));
      if (contracts.length > 0) {
        res.json({ contracts });
      } else {
        res
          .status(404)
          .json({ error: `No contract found for symbol: ${symbol}` });
      }
    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        error: "Failed to fetch Topstep contracts",
        details: err.message,
      });
    }
  }
);

// Topstep Account Search Endpoint
app.post("/api/trade/topstep/account", async (req: Request, res: Response) => {
  const { accountName } = req.body as { accountName: string };
  process.env.ACCOUNT_NAME = accountName;
  try {
    const sessionToken = process.env.TOPSTEP_API_SESSION_TOKEN;
    if (!sessionToken) {
      return res
        .status(400)
        .json({ error: "TOPSTEP_API_SESSION_TOKEN is required in .env.local" });
    }
    const url = "https://api.topstepx.com/api/Account/search";
    const response = await axios.post(
      url,
      {},
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (Array.isArray(response.data.accounts)) {
      interface TopstepAccount {
        id: string;
        name: string;
        canTrade: boolean;
        // Add other fields if needed
      }

      const account = (response.data.accounts as TopstepAccount[]).find(
        (acc) => {
          return (
            acc.name.toUpperCase().startsWith(accountName.toUpperCase()) &&
            acc.canTrade
          );
        }
      );
      if (account) {
        process.env.TOPSTEP_ACCOUNT_ID = account.id;
        console.log(
          `Topstep account ID for ${account.name} fetched and stored successfully.`
        );
        return res.json({ account });
      } else {
        return res
          .status(404)
          .json({ error: `No account found for name: ${accountName}` });
      }
    } else {
      return res
        .status(500)
        .json({ error: "Malformed response from Topstep API" });
    }
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      error: "Failed to fetch Topstep account information",
      details: err.message,
    });
  }
});

// Topstep Session Token (Authentication) Endpoint
app.post(
  "/api/trade/topstep/sessionToken",
  async (req: Request, res: Response) => {
    try {
      const username = process.env.TOPSTEP_USERNAME;
      const apiKey = process.env.TOPSTEP_API_KEY;
      if (!username || !apiKey) {
        return res.status(400).json({
          error:
            "TOPSTEP_USERNAME and TOPSTEP_API_KEY are required in .env.local",
        });
      }
      const url = "https://api.topstepx.com/api/Auth/loginKey";
      const payload = {
        username: username,
        apiKey: apiKey,
      };
      const response = await axios.post(url, payload, {
        headers: {
          "Accept ": "application/json",
          "Content-Type": "application/json",
        },
      });
      res.json(response.data);
      process.env.TOPSTEP_API_SESSION_TOKEN = response.data.token;
      console.log(`Topstep session token fetched and stored successfully.`);
    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        error: "Failed to fetch Topstep session token",
        details: err.message,
      });
    }
  }
);

// Schedule Topstep token refresh every 24 hours
cron.schedule("0 0 * * *", async () => {
  try {
    const username = process.env.TOPSTEP_USERNAME;
    const apiKey = process.env.TOPSTEP_API_KEY;
    if (!username || !apiKey) {
      console.error(
        "TOPSTEP_USERNAME and TOPSTEP_API_KEY are required in .env.local for scheduled token refresh"
      );
      return;
    }
    const url = "https://api.topstepx.com/api/Auth/loginKey";
    const payload = { username, apiKey };
    const response = await axios.post(url, payload, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    process.env.TOPSTEP_API_SESSION_TOKEN = response.data.token;
    console.log("[CRON] Topstep session token refreshed successfully.");
  } catch (error) {
    console.error(
      "[CRON] Failed to refresh Topstep session token:",
      error instanceof Error ? error.message : String(error)
    );
  }
});

// Schedule trade data synchronization every 1 minute
// Using standard cron format: minute hour day-of-month month day-of-week

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SERVER
//
// Auto-fetch Topstep session token, accountId, and contractId on server start
async function initializeTopstepSessionAndAccount() {
  try {
    const username = process.env.TOPSTEP_USERNAME;
    const apiKey = process.env.TOPSTEP_API_KEY;

    if (!username || !apiKey) {
      console.error(
        "TOPSTEP_USERNAME and TOPSTEP_API_KEY are required in .env.local for Topstep initialization"
      );
      return;
    }
    // Fetch session token
    const tokenRes = await axios.post(
      "https://api.topstepx.com/api/Auth/loginKey",
      { username, apiKey },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    process.env.TOPSTEP_API_SESSION_TOKEN = tokenRes.data.token;
    console.log("[INIT] Topstep session token fetched successfully.");
    // Fetch accountId
    const accountRes = await axios.post(
      "https://api.topstepx.com/api/Account/search",
      {},
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${process.env.TOPSTEP_API_SESSION_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (Array.isArray(accountRes.data.accounts)) {
      const tradable = accountRes.data.accounts.find(
        (acc: any) =>
          acc.canTrade &&
          acc.name
            .toUpperCase()
            .startsWith(process.env.ACCOUNT_NAME?.toUpperCase())
      );
      if (tradable) {
        process.env.TOPSTEP_ACCOUNT_ID = tradable.id;
        console.log(
          `[INIT] Topstep account ID for ${tradable.name} fetched and stored successfully.`
        );
      } else {
        console.warn(
          "[INIT] No tradable Topstep account found matching accountType."
        );
      }
    } else {
      console.warn("[INIT] No accounts array in Topstep account response.");
    }
    // Fetch contractId for default symbol

    // Initial sync of trades from the beginning of the month
    await performInitialTradeSync();
  } catch (error) {
    console.error(
      "[INIT] Failed to initialize Topstep session/account/contract:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

// Perform initial sync of trades from the beginning of the month
async function performInitialTradeSync() {
  try {
    const sessionToken = process.env.TOPSTEP_API_SESSION_TOKEN;
    const accountId = process.env.TOPSTEP_ACCOUNT_ID;

    console.log(
      `[INIT] Starting initial trade sync for accountId: ${accountId}`
    );
    console.log(
      `[INIT] Using session token: ${sessionToken ? "available" : "not set"}`
    );

    if (!sessionToken || !accountId) {
      console.error(
        "[INIT] Missing session token or account ID for initial trade synchronization"
      );
      return;
    }

    // Use first day of current month as startTimestamp and current time as endTimestamp
    const startTimestamp = getFirstDayOfCurrentMonth();
    const endTimestamp = new Date().toISOString();

    console.log(
      `[INIT] Performing initial sync of trades from ${startTimestamp} to ${endTimestamp}`
    );

    const url = `https://api.topstepx.com/api/Trade/search`;
    const payload = {
      accountId: parseInt(accountId),
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
    };

    const response = await axios.post(url, payload, {
      headers: {
        accept: "text/plain",
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    // Log trades to the database
    if (
      response.data &&
      response.data.trades &&
      Array.isArray(response.data.trades)
    ) {
      const { inserted, skipped } = await logTopstepTradesToDatabase(
        response.data.trades
      );
      console.log(
        `[INIT] Initial sync completed: ${response.data.trades.length} trades found, ${inserted} inserted, ${skipped} skipped`
      );

      // Mark initial sync as complete
      initialSyncDone = true;
    } else {
      console.log(`[INIT] Initial sync completed: No trades found`);
      initialSyncDone = true;
    }
  } catch (error) {
    console.error(
      "[INIT] Failed to perform initial trade sync:",
      error instanceof Error ? error.message : String(error)
    );
    // Even if initial sync fails, mark it as done so regular sync can begin
    initialSyncDone = true;
  }
}

// PORT FOR THE SERVER
const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== "test") {
  // Clear the trades table on server startup
  clearTradesTable()
    .then(() => {
      // Initialize Topstep session and account
      return initializeTopstepSessionAndAccount();
    })
    .finally(() => {
      server.listen(PORT, () => {
        console.log(`[INIT] Backend server running on port ${PORT}`);
      });

      // Setup Socket.IO event handlers
      io.on("connection", (socket) => {
        console.log("[SOCKET] New client connected:", socket.id);

        socket.on("disconnect", () => {
          console.log("[SOCKET] Client disconnected:", socket.id);
        });
      });
    });
}

// Helper function to broadcast new trades to all connected clients
export function broadcastNewTrade(trade: any) {
  io.emit("new-trade", trade);
  console.log("[SOCKET] Broadcasted new trade to all clients");
}

// Recreate the /api/trades endpoint
app.get("/api/trades", (req: Request, res: Response) => {
  tradesDb.all(
    "SELECT * FROM trades WHERE profitAndLoss IS NOT NULL ORDER BY creationTimestamp DESC",
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch trades:", err.message);
        return res.status(500).json({ error: "Failed to fetch trades" });
      }
      res.json(rows || []);
    }
  );
});

// Endpoint to clear the trades table
app.delete("/api/trades", (req: Request, res: Response) => {
  tradesDb.run("DELETE FROM trades", (err) => {
    if (err) {
      console.error("Failed to clear trades table:", err.message);
      return res.status(500).json({ error: "Failed to clear trades table" });
    }
    console.log("Trades table cleared successfully");
    res.json({ success: true, message: "Trades table cleared successfully" });
  });
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// DATABASE
//

app.post("/api/trade/topstep/data", async (req: Request, res: Response) => {
  const { accountId } = req.body as {
    accountId: number;
  };

  try {
    const sessionToken = process.env.TOPSTEP_API_SESSION_TOKEN;
    if (!sessionToken) {
      return res
        .status(400)
        .json({ error: "TOPSTEP_API_SESSION_TOKEN is required in .env.local" });
    }

    // Use first day of current month as startTimestamp and current time as endTimestamp
    const startTimestamp = getFirstDayOfCurrentMonth();
    const endTimestamp = new Date().toISOString();

    const url = `https://api.topstepx.com/api/Trade/search`;
    const payload = {
      accountId: accountId,
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
    };

    console.log(
      `[TOPSTEP] Fetching trades from ${startTimestamp} to ${endTimestamp}`
    );

    const response = await axios.post(url, payload, {
      headers: {
        accept: "text/plain",
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    // Log trades to the database
    if (
      response.data &&
      response.data.trades &&
      Array.isArray(response.data.trades)
    ) {
      const { inserted, skipped } = await logTopstepTradesToDatabase(
        response.data.trades
      );
      console.log(
        `[TOPSTEP] Processed ${response.data.trades.length} trades: ${inserted} inserted, ${skipped} skipped (duplicates)`
      );
    }

    res.json(response.data);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      error: "Failed to fetch Topstep trade data",
      details: err.message,
    });
  }
});

/**
 * Logs Topstep trades to the SQLite database, checking for duplicates
 * @param trades Array of trade objects from Topstep API
 * @returns Promise that resolves with counts of inserted and skipped trades
 */
function logTopstepTradesToDatabase(
  trades: any[]
): Promise<{ inserted: number; skipped: number }> {
  // console.log(
  //   "[DEBUG] tradesDb is",
  //   typeof tradesDb,
  //   tradesDb ? "OK" : "undefined"
  // );
  return new Promise((resolve, reject) => {
    let inserted = 0;
    let skipped = 0;

    // Process trades in a transaction
    tradesDb.serialize(async () => {
      tradesDb.run("BEGIN TRANSACTION");

      try {
        // Process each trade one by one to check for duplicates
        for (const trade of trades) {
          // Skip trades with null profitAndLoss without incrementing skipped count
          if (trade.profitAndLoss === null) {
            //console.log(`[DB] Skipping trade with null profitAndLoss: ${trade.orderId}`);
            continue;
          }

          // Check if this trade already exists in the database
          await new Promise<void>((resolveTrade, rejectTrade) => {
            tradesDb.get(
              "SELECT COUNT(*) as count FROM trades WHERE broker = ? AND orderId = ? AND creationTimestamp = ?",
              ["topstep", trade.orderId, trade.creationTimestamp],
              (err, row: { count: number }) => {
                if (err) {
                  rejectTrade(err);
                  return;
                }

                // If trade doesn't exist, insert it
                if (row.count === 0) {
                  // Convert the side number to a string (0 = 'buy', 1 = 'sell')
                  // we use trae.side === 1 ? 'buy' : 'sell' because the opposite side is used to fill an order of given side
                  const sideText = trade.side === 1 ? "buy" : "sell";

                  const tradeToInsert = {
                    broker: "topstep",
                    accountId: trade.accountId,
                    contractId: trade.contractId,
                    creationTimestamp: trade.creationTimestamp,
                    price: trade.price,
                    profitAndLoss: trade.profitAndLoss,
                    fees: trade.fees * 2,
                    side: sideText,
                    size: trade.size,
                    orderId: trade.orderId,
                  };

                  tradesDb.run(
                    `INSERT INTO trades (
                      broker, accountId, contractId, creationTimestamp, 
                      price, profitAndLoss, fees, side, size, orderId
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      tradeToInsert.broker, // broker (hardcoded as 'topstep')
                      tradeToInsert.accountId, // accountId
                      tradeToInsert.contractId, // contractId
                      tradeToInsert.creationTimestamp, // creationTimestamp
                      tradeToInsert.price, // price
                      tradeToInsert.profitAndLoss, // profitAndLoss (can be null)
                      tradeToInsert.fees, // fees
                      tradeToInsert.side, // side (as text)
                      tradeToInsert.size, // size
                      tradeToInsert.orderId, // orderId
                    ],
                    function (err) {
                      if (err) {
                        rejectTrade(err);
                      } else {
                        inserted++;
                        // Broadcast new trade to all connected clients
                        broadcastNewTrade(tradeToInsert);
                        resolveTrade();
                      }
                    }
                  );
                } else {
                  // Trade already exists, skip it
                  skipped++;
                  resolveTrade();
                }
              }
            );
          });
        }

        // Commit the transaction
        tradesDb.run("COMMIT", (err) => {
          if (err) {
            console.error("[DB] Error committing transaction:", err.message);
            reject(err);
          } else {
            resolve({ inserted, skipped });
          }
        });
      } catch (error) {
        // Rollback the transaction if any error occurred
        tradesDb.run("ROLLBACK");
        console.error("[DB] Error processing trades:", error);
        reject(error);
      }
    });
  });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SignalR
//
