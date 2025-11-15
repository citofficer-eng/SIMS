import React from 'react';
import { getApiBase } from '../constants';
import { pingServer } from '../services/api';
import { getLastFirebaseTimestamps } from '../services/api';

const DebugPanel: React.FC = () => {
  const [apiBase, setApiBase] = React.useState<string>('');
  const [ping, setPing] = React.useState<boolean | null>(null);
  const [lastTS, setLastTS] = React.useState<{ [k: string]: string }>({});

  React.useEffect(() => {
    setApiBase(getApiBase());
    let mounted = true;
    (async () => {
      try {
        const ok = await pingServer();
        if (mounted) setPing(ok);
      } catch (e) { if (mounted) setPing(false); }
    })();

    const id = setInterval(async () => {
      try {
        const ok = await pingServer();
        if (mounted) setPing(ok);
      } catch (e) { if (mounted) setPing(false); }
      try { if (mounted) setLastTS(getLastFirebaseTimestamps()); } catch (e) {}
    }, 5000);

    // initial timestamps
    try { setLastTS(getLastFirebaseTimestamps()); } catch (e) {}

    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className="text-xs bg-slate-50 dark:bg-slate-900 border rounded p-2">
      <div><strong>API_BASE:</strong> {apiBase}</div>
      <div><strong>Ping:</strong> {ping === null ? 'checking...' : ping ? 'ok' : 'down'}</div>
      <div className="mt-2"><strong>Last Firebase timestamps:</strong></div>
      <div className="text-xs max-h-40 overflow-auto">
        {Object.keys(lastTS).length === 0 && <div className="text-gray-500">(no data yet)</div>}
        {Object.entries(lastTS).map(([k,v]) => (
          <div key={k}><code className="font-mono">{k}</code>: {v ? new Date(String(v)).toLocaleTimeString() : '(n/a)'}</div>
        ))}
      </div>
    </div>
  );
};

export default DebugPanel;
