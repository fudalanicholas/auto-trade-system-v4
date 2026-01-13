import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import TradeMetrics from './TradeMetrics';
import './TradeTable.css';

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

interface TradeTableProps {
  selectedBroker: string;
}

export default function TradeTable({ selectedBroker }: TradeTableProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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

  // Refetch when selected broker changes or when component remounts
  useEffect(() => {
    console.log('Selected broker changed to:', selectedBroker);
    // Always fetch trades when broker changes or component remounts
    fetchTrades();
  }, [selectedBroker]);

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

      // Add debugging logs to verify response data
      console.log("Response data from /api/trades:", data);
    } catch (err) {
      setError('Error loading trade data. Please try again.');
      console.error('Failed to fetch trades:', err);
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch trades when component mounts
  useEffect(() => {
    console.log('TradeTable component mounted - fetching trades');
    fetchTrades();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  if (isLoading) {
    return <div className="loading">Loading trade data...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (trades.length === 0) {
    return (
      <div className="empty-state">
        <p>No trades found. Place some trades to see them here.</p>
        <p className="connection-status">
          {isConnected ? 
            <span className="connected">Live Updates Active</span> : 
            <span className="disconnected">Disconnected</span>
          }
        </p>
      </div>
    );
  }

  // Filter trades based on selected broker
  const filteredTrades = selectedBroker === 'all' 
    ? trades 
    : trades.filter(trade => trade.broker.toLowerCase() === selectedBroker.toLowerCase());

  return (
    <div>
      {filteredTrades.length > 0 && (
        <div className="metrics-section">
          <TradeMetrics trades={filteredTrades} selectedBroker={selectedBroker} />
        </div>
      )}
      
      <div className="table-section">
        <div className="table-header">
          <h3>Trade History</h3>
          <div className="table-actions">
            <div className="connection-indicator">
              {isConnected ? 
                <span className="connected">Live Updates Active</span> : 
                <span className="disconnected">Disconnected</span>
              }
            </div>
          </div>
        </div>
        {filteredTrades.length === 0 ? (
          <div className="empty-state">
            <p>No trades found for the selected broker.</p>
            <p>Try selecting a different broker from the dropdown above.</p>
          </div>
        ) : (
        <table>
          <thead>
            <tr>
              <th>Broker</th>
              <th>Account</th>
              <th>Contract</th>
              <th>Size</th>
              <th>Price</th>
              <th>P&L</th>
              <th>Fees</th>
              <th>Side</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.map((trade, index) => (
              <tr key={`${trade.broker}-${trade.orderId}-${index}`} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td>{trade.broker}</td>
                <td>{trade.accountId}</td>
                <td>{trade.contractId}</td>
                <td>{trade.size}</td>
                <td>{formatPrice(trade.price)}</td>
                <td className={trade.profitAndLoss && trade.profitAndLoss > 0 ? 'profit' : 'loss'}>
                  {trade.profitAndLoss !== null ? formatPrice(trade.profitAndLoss) : 'N/A'}
                </td>
                <td>{formatPrice(trade.fees)}</td>
                <td className={`side-${trade.side.toLowerCase()}`}>
                  {trade.side.toUpperCase()}
                </td>
                <td>{new Date(trade.creationTimestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}