# Auto-Trade System v4

## Setup Instructions

1. Create a `.env.local` file in the `backend` directory with your API credentials:

```
# Topstep API Credentials
TOPSTEP_USERNAME=your_username
TOPSTEP_API_KEY=your_api_key
TOPSTEP_API_SESSION_TOKEN=
TOPSTEP_API_SESSION_TIMESTAMP=
```

## Running the Application

### Start the backend:

```bash
cd backend
npm start
```

Or for development with auto-restart:

```bash
cd backend
npm run dev
```

### Start the frontend:

```bash
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

### Start ngrok for webhook access:

```bash
ngrok http 4000
```

## Real-time Trading Features

- **Live WebSocket Updates**: The dashboard receives real-time trade updates via WebSocket
- **Smart Database Sync**: Initial sync from beginning of month, then regular 1-minute syncs
- **Filtered Data**: Only trades with valid profit/loss values are displayed
- **Connection Status**: The dashboard shows WebSocket connection status

This implementation adds real-time trade updates to the dashboard using WebSockets, so trades will appear on the dashboard as soon as they happen (1-minute interval), without requiring manual refresh.

1. **Backend (Socket.IO Server)**

   - Set up a Socket.IO server alongside Express
   - Added a broadcast function to emit new trades to all connected clients
   - Modified the trade logging function to broadcast new trades when they're added to the database
   - **New: Trades with null profitAndLoss are filtered out and not logged or broadcast**

2. **Frontend (Socket.IO Client)**
   - Connected to the WebSocket server from the TradeTable component
   - Added real-time updates when new trades are received
   - Added a connection status indicator to show WebSocket connectivity
   - **New: Ignores incoming WebSocket trades with null profitAndLoss**

- Trades with `profitAndLoss: null` are ignored at multiple levels:
  1. When logging trades to the database
  2. When querying trades from the database (`/api/trades` endpoint)
  3. When receiving trades via WebSocket on the frontend
  4. When displaying trades that might have been in the database before this filter was added

This ensures that only trades with valid profit and loss values are displayed on the dashboard.

## WebSocket Events

- `new-trade`: Emitted when a new trade is added to the database
- `connect`: Connection established
- `disconnect`: Connection lost

## ACCOUNT SPECIFICATION

IMPORTANT: In server.ts on line 499 be sure to specify your account name from topstep
acc.name.toUpperCase().startsWith("50KTC-V2-231459-40970965"))
-change 50KTC... to your account name

## TradingView Alert Format

{
"contractId": "CON.F.US.ENQ.U25",
"broker": "topstep",
"quantity": "{{strategy.order.contracts}}",
"side": "{{strategy.order.action}}",
"key": "XCtCCAEw2G8Dg9"
}
