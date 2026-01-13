import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import PnLChart from './PnLChart.tsx';
import BrokerPieChart from './BrokerPieChart.tsx';
import DailyPerformanceChart from './DailyPerformanceChart.tsx';
import './Analytics.css';

interface Trade {
  broker: string;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  price: number;
  profitAndLoss: number | null;
  fees: number;
  side: string;
  size: number;
  orderId: number;
}

export default function Analytics() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBroker, setSelectedBroker] = useState('all');
  const [dateRange, setDateRange] = useState('7d'); // Default to 7 days
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    // Connect to the WebSocket server
    const socketConnection = io(import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 10000,
    });

    // Setup event listeners
    socketConnection.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });

    socketConnection.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    socketConnection.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setIsConnected(false);
    });

    // Save socket connection to state
    setSocket(socketConnection);

    // Clean up on unmount
    return () => {
      console.log('Closing WebSocket connection');
      socketConnection.disconnect();
    };
  }, []);

  // Listen for new trade events
  useEffect(() => {
    if (!socket) return;
    
    const newTradeListener = (newTrade: Trade) => {
      console.log('New trade received via WebSocket:', newTrade);
      
      // Skip trades with null P&L
      if (newTrade.profitAndLoss === null) {
        console.log('Ignoring trade with null P&L');
        return;
      }
      
      // Add new trade to the beginning of the trades array
      setTrades(prevTrades => {
        // Check if the trade already exists to prevent duplicates
        const tradeExists = prevTrades.some(
          trade => 
            trade.broker === newTrade.broker && 
            trade.orderId === newTrade.orderId && 
            trade.creationTimestamp === newTrade.creationTimestamp
        );
        
        if (tradeExists) {
          return prevTrades;
        }
        
        // Return new array with the new trade at the beginning
        return [newTrade, ...prevTrades];
      });
    };

    // Register event listener
    socket.on('new-trade', newTradeListener);

    // Clean up listener when component unmounts or socket changes
    return () => {
      socket.off('new-trade', newTradeListener);
    };
  }, [socket]);

  // Fetch trades when component mounts or filters change
  useEffect(() => {
    fetchTrades();
  }, [selectedBroker, dateRange]);

  const fetchTrades = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/trades');
      
      if (!response.ok) {
        throw new Error('Failed to fetch trades');
      }
      
      const data = await response.json();
      // Check if data is an array and has elements
      if (Array.isArray(data)) {
        // Filter out trades with null profitAndLoss
        const filteredTrades = data.filter(trade => trade.profitAndLoss !== null);
        setTrades(filteredTrades);
        setError(null);
        
        // Log if any trades were filtered out
        if (filteredTrades.length < data.length) {
          console.log(`Filtered out ${data.length - filteredTrades.length} trades with null P&L`);
        }
      } else {
        // If data is not an array or contains an error message
        setTrades([]);
        setError(data.error || 'Invalid response format');
        console.error('Invalid response format:', data);
      }
    } catch (err) {
      setError('Error loading trade data. Please try again.');
      console.error('Failed to fetch trades:', err);
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter trades based on selected broker and date range
  const getFilteredTrades = () => {
    let filteredByBroker = selectedBroker === 'all' 
      ? trades 
      : trades.filter(trade => trade.broker.toLowerCase() === selectedBroker.toLowerCase());
    
    // Apply date range filter
    const now = new Date();
    let startDate: Date;
    
    switch(dateRange) {
      case '1d':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case '7d':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case '30d':
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7)); // Default to 7 days
        break;
    }
    
    return filteredByBroker.filter(trade => new Date(trade.creationTimestamp) >= startDate);
  };

  if (isLoading) {
    return <div className="loading">Loading analytics data...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const filteredTrades = getFilteredTrades();

  if (filteredTrades.length === 0) {
    return (
      <div className="analytics-container">
        <div className="analytics-filters">
          <div className="filter-group">
            <label htmlFor="broker-select">Broker:</label>
            <select 
              id="broker-select"
              className="filter-select"
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
            >
              <option value="all">All Brokers</option>
              <option value="topstep">Topstep</option>
              <option value="kraken">Kraken</option>
              <option value="ibkr">IBKR</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="date-range-select">Date Range:</label>
            <select 
              id="date-range-select"
              className="filter-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="1d">Last 1 Day</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
        
        <div className="empty-state">
          <p>No trade data available for the selected filters.</p>
          <p>Try adjusting your filter settings or switching to a different time period.</p>
          <p className="connection-status">
            {isConnected ? 
              <span className="connected">Live Updates Active</span> : 
              <span className="disconnected">Disconnected</span>
            }
          </p>
        </div>
      </div>
    );
  }

  // Calculate total profit and loss
  const totalPnL = filteredTrades.reduce((sum, trade) => 
    sum + ((trade.profitAndLoss || 0) - trade.fees), 0);

  // Calculate winning trade percentage
  const winningTrades = filteredTrades.filter(trade => (trade.profitAndLoss || 0) - trade.fees > 0);
  const winRate = (winningTrades.length / filteredTrades.length) * 100;

  // Calculate average trade P&L
  const avgPnL = totalPnL / filteredTrades.length;

  return (
    <div className="analytics-container">
      <div className="analytics-filters">
        <div className="filter-group">
          <label htmlFor="broker-select">Broker:</label>
          <select 
            id="broker-select"
            className="filter-select"
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
          >
            <option value="all">All Brokers</option>
            <option value="topstep">Topstep</option>
            <option value="kraken">Kraken</option>
            <option value="ibkr">IBKR</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="date-range-select">Date Range:</label>
          <select 
            id="date-range-select"
            className="filter-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="1d">Last 1 Day</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
        
        <div className="connection-indicator">
          {isConnected ? 
            <span className="connected">Live Updates Active</span> : 
            <span className="disconnected">Disconnected</span>
          }
        </div>
      </div>
      
      <div className="analytics-summary">
        <div className={`summary-card ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
          <h3>Total P&L</h3>
          <div className="summary-value">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
            }).format(totalPnL)}
          </div>
        </div>
        
        <div className="summary-card">
          <h3>Win Rate</h3>
          <div className="summary-value">{winRate.toFixed(1)}%</div>
        </div>
        
        <div className="summary-card">
          <h3>Trade Count</h3>
          <div className="summary-value">{filteredTrades.length}</div>
        </div>
        
        <div className="summary-card">
          <h3>Avg. P&L per Trade</h3>
          <div className="summary-value">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
            }).format(avgPnL)}
          </div>
        </div>
      </div>
      
      <div className="chart-grid">
        <div className="chart-container pnl-chart">
          <h3>Profit & Loss Over Time</h3>
          <PnLChart trades={filteredTrades} />
        </div>
        
        <div className="chart-container performance-chart">
          <h3>Daily Performance</h3>
          <DailyPerformanceChart trades={filteredTrades} />
        </div>
        
        <div className="chart-container broker-chart">
          <h3>Trades by Broker</h3>
          <BrokerPieChart trades={filteredTrades} />
        </div>
      </div>
    </div>
  );
}
