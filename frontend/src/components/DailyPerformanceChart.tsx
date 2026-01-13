import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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

interface DailyPerformanceChartProps {
  trades: Trade[];
}

export default function DailyPerformanceChart({ trades }: DailyPerformanceChartProps) {
  // Group trades by day and calculate daily P&L
  const dailyPnL = trades.reduce((acc: Record<string, number>, trade) => {
    const date = new Date(trade.creationTimestamp).toISOString().split('T')[0];
    const tradePnL = (trade.profitAndLoss || 0) - trade.fees;
    
    if (!acc[date]) {
      acc[date] = 0;
    }
    
    acc[date] += tradePnL;
    return acc;
  }, {});

  // Sort dates chronologically
  const sortedDates = Object.keys(dailyPnL).sort();
  
  // Format dates for display
  const formattedDates = sortedDates.map(date => {
    const [year, month, day] = date.split('-');
    return `${month}/${day}/${year.slice(2)}`;
  });

  // Get daily P&L values
  const dailyValues = sortedDates.map(date => dailyPnL[date]);

  // Define bar colors based on P&L value
  const barColors = dailyValues.map(value => 
    value >= 0 ? 'rgba(75, 192, 75, 0.8)' : 'rgba(255, 99, 132, 0.8)'
  );

  const barBorderColors = dailyValues.map(value => 
    value >= 0 ? 'rgb(75, 192, 75)' : 'rgb(255, 99, 132)'
  );

  // Prepare chart data
  const data = {
    labels: formattedDates,
    datasets: [
      {
        label: 'Daily P&L',
        data: dailyValues,
        backgroundColor: barColors,
        borderColor: barBorderColors,
        borderWidth: 1
      }
    ]
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `P&L: ${new Intl.NumberFormat('en-US', {
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
        beginAtZero: true
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  // Check if we have any data to display
  if (sortedDates.length === 0) {
    return (
      <div style={{ height: '300px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        No daily performance data available
      </div>
    );
  }

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Bar data={data} options={options} />
    </div>
  );
}
