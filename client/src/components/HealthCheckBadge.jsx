import React, { useEffect, useState } from 'react';
import { checkBackendHealth } from '../services/api';
import { Activity, RefreshCw } from 'lucide-react';

const HealthCheckBadge = () => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
  const [details, setDetails] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const testConnection = async () => {
    setIsRefreshing(true);
    setStatus('checking');
    const result = await checkBackendHealth();
    if (result.success) {
      setStatus('connected');
      setDetails(result.data.message || 'Express server running on port 5000');
    } else {
      setStatus('disconnected');
      setDetails(result.error || 'Check if server is running on port 5000');
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-surface border border-dark-border text-xs">
      {status === 'checking' && (
        <>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span className="text-amber-300 font-medium">Checking Server...</span>
        </>
      )}

      {status === 'connected' && (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 font-medium">Backend: Connected</span>
        </>
      )}

      {status === 'disconnected' && (
        <>
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          <span className="text-rose-400 font-medium">Backend: Offline</span>
        </>
      )}

      <button
        onClick={testConnection}
        title={`Status: ${details}. Click to refresh`}
        className="ml-1 text-dark-muted hover:text-white transition-colors p-0.5 rounded"
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-brand-purple' : ''}`} />
      </button>
    </div>
  );
};

export default HealthCheckBadge;

