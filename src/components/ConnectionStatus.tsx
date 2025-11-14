import React, { useEffect, useState } from 'react';
import { pingServer } from '../services/api';
import { getQueueStats } from '../utils/syncQueue';

const ConnectionStatus: React.FC = () => {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);
  const [pending, setPending] = useState<number>(0);
  const [nextAttemptAt, setNextAttemptAt] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    let mounted = true;
    (async () => {
      try {
        const ok = await pingServer();
        if (mounted) setBackendAlive(ok);
      } catch (e) {
        if (mounted) setBackendAlive(false);
      }
      try {
        const stats = getQueueStats();
        if (mounted) { setPending(stats.pending); setNextAttemptAt(stats.nextAttemptAt); }
      } catch (e) {
        console.warn('Failed to read queue stats', e);
      }
    })();

    const interval = setInterval(async () => {
      try {
        const ok = await pingServer();
        if (mounted) setBackendAlive(ok);
      } catch (e) {
        if (mounted) setBackendAlive(false);
      }
      try {
        const stats = getQueueStats();
        if (mounted) { setPending(stats.pending); setNextAttemptAt(stats.nextAttemptAt); }
      } catch (e) {
        console.warn('Failed to read queue stats', e);
      }
    }, 15000);

    return () => { mounted = false; window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); clearInterval(interval); };
  }, []);

  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`} aria-hidden />
      <span>{online ? 'Online' : 'Offline'}</span>
      <span className="mx-2">•</span>
      <span>{backendAlive === null ? 'Checking server...' : backendAlive ? 'Backend reachable' : 'Backend unreachable'}</span>
      {pending > 0 && (
        <>
          <span className="mx-2">•</span>
          <span>{pending} pending</span>
          {nextAttemptAt && <span className="mx-2">•</span>}
          {nextAttemptAt && <span>next: {new Date(nextAttemptAt).toLocaleTimeString()}</span>}
        </>
      )}
    </div>
  );
};

export default ConnectionStatus;
