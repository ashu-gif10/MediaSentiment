import React from 'react';

const StatCard = ({ title, value, percentage, icon: Icon, color, trend }) => {
  // Color themes for each stat card
  const colorStyles = {
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20 hover:border-purple-500/40',
      iconBg: 'bg-purple-500/20 text-purple-400',
      text: 'text-purple-400',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
      text: 'text-emerald-400',
    },
    rose: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20 hover:border-rose-500/40',
      iconBg: 'bg-rose-500/20 text-rose-400',
      text: 'text-rose-400',
    },
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20 hover:border-blue-500/40',
      iconBg: 'bg-blue-500/20 text-blue-400',
      text: 'text-blue-400',
    },
  };

  const style = colorStyles[color] || colorStyles.purple;

  return (
    <div
      className={`relative overflow-hidden bg-dark-card border ${style.border} rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-dark-muted uppercase tracking-wider">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-white mt-1.5 tracking-tight">
            {value}
          </h3>
          {percentage !== undefined && (
            <p className="text-xs text-dark-muted mt-2 flex items-center gap-1.5">
              <span className={`font-semibold ${style.text}`}>{percentage}%</span>
              <span>of total comments</span>
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${style.iconBg} shadow-inner`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;

