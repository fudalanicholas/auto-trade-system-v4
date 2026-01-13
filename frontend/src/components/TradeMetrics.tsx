import { useEffect, useState } from 'react';
import './TradeMetrics.css';

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

interface TradeMetricsProps {
  trades: Trade[];
  selectedBroker: string;
}

export default function TradeMetrics({ trades, selectedBroker }: TradeMetricsProps) {
  const [totalPnL, setTotalPnL] = useState<number>(0);
  const [winPercentage, setWinPercentage] = useState<number>(0);
  const [profitFactor, setProfitFactor] = useState<number>(0);

  useEffect(() => {
    // Filter trades based on selected broker
    const filteredTrades = selectedBroker === 'all' 
      ? trades 
      : trades.filter(trade => trade.broker.toLowerCase() === selectedBroker.toLowerCase());
    
    // Only consider trades with non-null P&L values
    const tradesWithPnL = filteredTrades.filter(trade => trade.profitAndLoss !== null);
    
    if (tradesWithPnL.length === 0) {
      setTotalPnL(0);
      setWinPercentage(0);
      setProfitFactor(0);
      return;
    }

    // Calculate total P&L (subtracting fees)
    const pnlTotal = tradesWithPnL.reduce((sum, trade) => 
      sum + (trade.profitAndLoss || 0) - trade.fees, 0);
    setTotalPnL(pnlTotal);

    // Calculate win percentage (accounting for fees)
    const winningTrades = tradesWithPnL.filter(trade => (trade.profitAndLoss || 0) - trade.fees > 0);
    const winRate = (winningTrades.length / tradesWithPnL.length) * 100;
    setWinPercentage(winRate);

    // Calculate profit factor (sum of profits / sum of losses)
    const profits = tradesWithPnL
      .filter(trade => (trade.profitAndLoss || 0) - trade.fees > 0)
      .reduce((sum, trade) => sum + ((trade.profitAndLoss || 0) - trade.fees), 0);
    
    const losses = tradesWithPnL
      .filter(trade => (trade.profitAndLoss || 0) - trade.fees < 0)
      .reduce((sum, trade) => sum + Math.abs((trade.profitAndLoss || 0) - trade.fees), 0);
    
    const profitFactorValue = losses > 0 ? profits / losses : profits > 0 ? Infinity : 0;
    setProfitFactor(profitFactorValue);
  }, [trades, selectedBroker]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (trades.length === 0) {
    return (
      <div className="trade-metrics">
        <h3>Performance Summary</h3>
        <div className="empty-metrics">
          No trade data available
        </div>
      </div>
    );
  }

  return (
    <div className="trade-metrics">
      <h3>Performance Summary</h3>
      <div className="metrics-grid">
        <div className={`metric ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
          <div className="metric-title">Total P&L</div>
          <div className="metric-value">{formatCurrency(totalPnL)}</div>
          <div className="metric-detail">
            {selectedBroker === 'all' ? 'All brokers' : selectedBroker}
          </div>
        </div>

        <div className="metric">
          <div className="metric-title">Win Rate</div>
          <div className="metric-value">{winPercentage.toFixed(1)}%</div>
          <div className="metric-detail">
            {trades.filter(trade => trade.profitAndLoss !== null).length} trades
          </div>
        </div>

        <div className="metric">
          <div className="metric-title">Profit Factor</div>
          <div className="metric-value">
            {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
          </div>
          <div className="metric-detail">
            Profit/Loss
          </div>
        </div>
      </div>
    </div>
  );
}