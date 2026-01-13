import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  ArcElement,
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

interface BrokerPieChartProps {
  trades: Trade[];
}

export default function BrokerPieChart({ trades }: BrokerPieChartProps) {
  // Count trades by broker
  const brokerCounts: Record<string, number> = {};
  trades.forEach(trade => {
    const broker = trade.broker;
    if (!brokerCounts[broker]) {
      brokerCounts[broker] = 0;
    }
    brokerCounts[broker] += 1;
  });

  // Extract broker names and counts
  const brokers = Object.keys(brokerCounts);
  const counts = brokers.map(broker => brokerCounts[broker]);

  // Define colors for each broker
  const generateColors = (count: number, alpha: number = 0.8) => {
    const colors = [
      `rgba(255, 99, 132, ${alpha})`,
      `rgba(54, 162, 235, ${alpha})`,
      `rgba(255, 206, 86, ${alpha})`,
      `rgba(75, 192, 192, ${alpha})`,
      `rgba(153, 102, 255, ${alpha})`,
      `rgba(255, 159, 64, ${alpha})`,
      `rgba(199, 199, 199, ${alpha})`,
      `rgba(83, 102, 255, ${alpha})`,
      `rgba(78, 235, 133, ${alpha})`,
      `rgba(255, 99, 255, ${alpha})`,
    ];

    // If we have more brokers than colors, reuse colors
    return Array.from({ length: count }, (_, index) => colors[index % colors.length]);
  };

  const backgroundColor = generateColors(brokers.length);
  const borderColor = generateColors(brokers.length, 1);

  // Prepare chart data
  const data = {
    labels: brokers,
    datasets: [
      {
        label: 'Trades',
        data: counts,
        backgroundColor,
        borderColor,
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
        position: 'right' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.formattedValue || '';
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.raw / total) * 100).toFixed(1);
            return `${label}: ${value} trades (${percentage}%)`;
          }
        }
      }
    }
  };

  // Check if we have any data to display
  if (brokers.length === 0) {
    return (
      <div style={{ height: '300px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        No broker data available
      </div>
    );
  }

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Pie data={data} options={options} />
    </div>
  );
}
