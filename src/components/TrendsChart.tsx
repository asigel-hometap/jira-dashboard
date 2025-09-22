import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TrendsChartProps {
  data: {
    labels: string[];
    healthDatasets: any[];
    statusDatasets: any[];
  };
  seriesType: 'health' | 'status';
  loading: boolean;
}

const TrendsChart = React.memo(({ data, seriesType, loading }: TrendsChartProps) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const chartData = {
    labels: data.labels,
    datasets: seriesType === 'health' ? data.healthDatasets : data.statusDatasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 6,
        displayColors: true,
        titleFont: {
          size: 14,
          weight: 'bold' as const
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        callbacks: {
          title: function(context: any) {
            return `Week: ${context[0].label}`;
          },
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            
            // Calculate total for percentage
            const chart = context.chart;
            const dataIndex = context.dataIndex;
            const datasets = chart.data.datasets;
            const total = datasets.reduce((sum: number, dataset: any) => {
              return sum + (dataset.data[dataIndex] || 0);
            }, 0);
            
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} projects (${percentage}%)`;
          },
          footer: function(context: any) {
            // Calculate total from all visible datasets
            const total = context.reduce((sum: number, item: any) => sum + (item.parsed.y || 0), 0);
            return `Total: ${total} projects`;
          }
        }
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          stepSize: 1,
        },
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
  };

  return (
    <div className="h-96 w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
});

TrendsChart.displayName = 'TrendsChart';

export default TrendsChart;
