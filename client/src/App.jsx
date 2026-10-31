
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AnalysisHistory from './pages/AnalysisHistory';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loadedAnalysis, setLoadedAnalysis] = useState(null);

  const handleViewSavedAnalysis = (analysisData) => {
    setLoadedAnalysis(analysisData);
    setActiveTab('dashboard');
  };

  const handleStartNewAnalysis = () => {
    setLoadedAnalysis(null);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex font-sans antialiased">

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-300">

        {(activeTab === 'dashboard' || activeTab === 'new-analysis' || activeTab === 'results') && (
          <Dashboard
            onOpenSidebar={() => setSidebarOpen(true)}
            loadedAnalysis={loadedAnalysis}
            onClearLoadedAnalysis={() => setLoadedAnalysis(null)}
          />
        )}

        {activeTab === 'history' && (
          <AnalysisHistory
            onOpenSidebar={() => setSidebarOpen(true)}
            onViewAnalysis={handleViewSavedAnalysis}
            onNewAnalysis={handleStartNewAnalysis}
          />
        )}

        {activeTab !== 'dashboard' && activeTab !== 'new-analysis' && activeTab !== 'results' && activeTab !== 'history' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center bg-dark-card border border-dark-border rounded-2xl p-8 max-w-md">

              <h3 className="text-lg font-bold text-white capitalize">
                {activeTab} Page
              </h3>

              <p className="text-xs text-dark-muted mt-2">
                This page will be connected in subsequent phases.
              </p>

              <button
                onClick={() => setActiveTab('dashboard')}
                className="mt-4 px-4 py-2 bg-brand-purple hover:bg-purple-600 text-white rounded-xl text-xs font-semibold"
              >
                Return to Dashboard
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
