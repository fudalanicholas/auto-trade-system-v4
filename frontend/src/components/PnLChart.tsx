import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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

interface PnLChartProps {
  trades: Trade[];
}

export default function PnLChart({ trades }: PnLChartProps) {
  // Sort trades by timestamp (oldest first)
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.creationTimestamp).getTime() - new Date(b.creationTimestamp).getTime()
  );

  // Calculate cumulative P&L
  let cumulativePnL = 0;
  const chartData = sortedTrades.map(trade => {
    const tradePnL = (trade.profitAndLoss || 0) - trade.fees;
    cumulativePnL += tradePnL;
    return {
      timestamp: new Date(trade.creationTimestamp),
      pnl: tradePnL,
      cumulativePnL: cumulativePnL
    };
  });

  // Format dates for x-axis
  const labels = chartData.map(data => {
    const date = data.timestamp;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  // Prepare chart data
  const data = {
    labels,
    datasets: [
      {
        label: 'Cumulative P&L',
        data: chartData.map(data => data.cumulativePnL),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.3,
        fill: {
          target: 'origin',
          above: 'rgba(53, 162, 235, 0.2)',
          below: 'rgba(255, 99, 132, 0.2)'
        },
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `Cumulative P&L: ${new Intl.NumberFormat('en-US', {
              style: 'currency', 
              currency: 'USD'
            }).format(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: function(value: string | number) {
            return new Intl.NumberFormat('en-US', {
              style: 'currency', 
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(Number(value));
          }
        },
        grid: {
          color: 'rgba(200, 200, 200, 0.2)'
        },
        beginAtZero: false
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  // Check if we have chart data to display
  if (chartData.length === 0) {
    return (
      <div style={{ height: '300px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        No trade data available for the chart
      </div>
    );
  }

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Line data={data} options={options} />
    </div>
  );
}
