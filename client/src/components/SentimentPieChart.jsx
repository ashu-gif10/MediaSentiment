import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-dark-surface border border-dark-border px-3.5 py-2 rounded-xl shadow-xl">
        <p className="text-xs font-semibold text-slate-200">{data.name}</p>
        <p className="text-sm font-bold" style={{ color: data.payload.color }}>
          {data.value} comments ({data.payload.percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

const SentimentPieChart = ({ data }) => {
  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide">
            Sentiment Distribution
          </h3>
          <p className="text-xs text-dark-muted mt-0.5">
            Breakdown across Positive, Negative & Neutral
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
          AI Classified
        </span>
      </div>

      <div className="w-full h-64 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#111625" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              iconType="circle"
              wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SentimentPieChart;

