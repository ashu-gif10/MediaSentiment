import React from 'react';
import { 
  LayoutDashboard, 
  Sparkles, 
  History, 
  Youtube, 
  Settings, 
  X,
  PieChart,
  ShieldAlert
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose, activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-analysis', label: 'New Analysis', icon: Youtube },
    { id: 'results', label: 'Analysis Results', icon: PieChart },
    { id: 'history', label: 'Analysis History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-dark-surface border-r border-dark-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-purple to-brand-blue flex items-center justify-center shadow-lg shadow-purple-900/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide leading-tight">
                Media<span className="text-brand-purple">Sentiment</span>
              </h1>
              <span className="text-[10px] text-dark-muted font-medium uppercase tracking-wider block">
                AI YouTube Analytics
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-dark-muted hover:text-white hover:bg-dark-card"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-dark-muted uppercase">
            Main Menu
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-purple/20 to-brand-blue/10 text-white border border-brand-purple/30 shadow-md'
                    : 'text-dark-muted hover:text-white hover:bg-dark-card/60'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-purple' : 'text-dark-muted'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* AI Model Tag & Footer */}
        <div className="p-4 border-t border-dark-border">
          <div className="bg-dark-card/80 border border-dark-border rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-cyan"></span>
              <p className="text-xs font-semibold text-slate-200">Powered by Gemini AI</p>
            </div>
            <p className="text-[11px] text-dark-muted leading-relaxed">
              Real-time comment classification with YouTube API v3.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

