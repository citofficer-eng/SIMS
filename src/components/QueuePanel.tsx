import React from 'react';
import { getQueue, removeFromQueue, retryNow, processQueue } from '../utils/syncQueue';

const QueuePanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [items, setItems] = React.useState(() => getQueue());

  const refresh = () => setItems(getQueue());

  React.useEffect(() => {
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const handleCancel = (id: string) => {
    removeFromQueue(id);
    refresh();
  };

  const handleRetry = (id: string) => {
    retryNow(id);
    processQueue();
    refresh();
  };

  const summarize = (it: any) => {
    try {
      if (!it.payload) return '';
      if (it.type === 'team:update') return it.payload.name || `Team ${it.payload.id}`;
      if (it.type === 'activity:log') return `${it.payload.action} by ${it.payload.userId || 'unknown'}`;
      if (it.type === 'visibility:update') return `Visibility changes: ${Object.keys(it.payload || {}).join(', ')}`;
      if (it.type === 'point:add') return `Points ${it.payload.points} (${it.payload.type}) for ${it.payload.teamId}`;
      return JSON.stringify(it.payload).slice(0, 120);
    } catch (e) { return ''; }
  };

  if (!items.length) return (
    <div className="p-2 text-xs">No queued actions.</div>
  );

  return (
    <div className="bg-white border rounded shadow p-2 w-80 text-sm">
      <div className="flex items-center justify-between mb-2">
        <strong>Pending Actions</strong>
        <button className="text-xs text-gray-600" onClick={() => { onClose && onClose(); }}>Close</button>
      </div>
      <div className="max-h-64 overflow-auto">
        {items.map(it => (
          <div key={it.id} className="border-b py-2">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{it.type}</div>
                <div className="text-xs text-gray-700">{summarize(it)}</div>
                <div className="text-xs text-gray-600">Created: {new Date(it.createdAt).toLocaleString()}</div>
                <div className="text-xs text-gray-600">Attempts: {it.attempts}</div>
                {it.nextAttemptAt && <div className="text-xs text-gray-600">Next: {new Date(it.nextAttemptAt).toLocaleTimeString()}</div>}
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => handleRetry(it.id)} className="px-2 py-1 bg-green-500 text-white rounded text-xs">Retry</button>
                <button onClick={() => handleCancel(it.id)} className="px-2 py-1 bg-red-200 text-red-700 rounded text-xs">Cancel</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueuePanel;
