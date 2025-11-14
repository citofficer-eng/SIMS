import React from 'react';
import { getAuditLogs } from '../services/api';
import { getQueue } from '../utils/syncQueue';

const AuditAdmin: React.FC = () => {
  const [serverLogs, setServerLogs] = React.useState<any[]>([]);
  const [queued, setQueued] = React.useState<any[]>([]);

  const load = async () => {
    try {
      const s = await getAuditLogs();
      setServerLogs(s || []);
    } catch (e) {
      console.warn('Failed to fetch audit logs', e);
    }
    setQueued(getQueue().filter(q => q.type === 'activity:log'));
  };

  React.useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Audit Logs</h2>
      <div className="mb-4">
        <h3 className="font-semibold">Server Logs</h3>
        <div className="border rounded p-2 max-h-64 overflow-auto">
          {serverLogs.length ? serverLogs.map(s => (
            <div key={s.id} className="border-b py-1 text-sm"><div className="font-medium">{s.action}</div><div className="text-xs text-gray-600">By {s.userId} at {new Date(s.timestamp).toLocaleString()}</div></div>
          )) : <div className="text-xs text-gray-500">No server logs</div>}
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Queued Local Audit Logs</h3>
        <div className="border rounded p-2 max-h-64 overflow-auto">
          {queued.length ? queued.map(q => (
            <div key={q.id} className="border-b py-1 text-sm"><div className="font-medium">{q.payload.action}</div><div className="text-xs text-gray-600">By {q.payload.userId || 'unknown'} created {new Date(q.createdAt).toLocaleString()}</div></div>
          )) : <div className="text-xs text-gray-500">No queued audits</div>}
        </div>
      </div>
    </div>
  );
};

export default AuditAdmin;
