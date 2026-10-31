import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

const CustomBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-dark-surface border border-dark-border px-3.5 py-2 rounded-xl shadow-xl">
        <p className="text-xs font-semibold text-slate-200">Topic / Keyword: #{data.keyword}</p>
        <p className="text-sm font-bold text-brand-cyan">
          Mentioned {data.count} times
        </p>
      </div>
    );
  }
  return null;
};

const KeywordBarChart = ({ data }) => {
  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide">
            Top Mentioned Keywords & Topics
          </h3>
          <p className="text-xs text-dark-muted mt-0.5">
            Key themes extracted from comments
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
          NLP Extracted
        </span>
      </div>

      <div className="w-full h-64 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <XAxis type="number" stroke="#8e9bbb" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis 
              type="category" 
              dataKey="keyword" 
              stroke="#8e9bbb" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              width={70} 
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Bar dataKey="count" radius={[0, 8, 8, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`bar-${index}`} 
                  fill={index === 0 ? '#8b5cf6' : index === 1 ? '#3b82f6' : '#06b6d4'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default KeywordBarChart;

