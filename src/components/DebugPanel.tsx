import React from 'react';
import { getApiBase } from '../constants';
import { pingServer, writeToFirebaseData } from '../services/api';
import { getLastFirebaseTimestamps } from '../services/api';
import { INITIAL_MOCK_USERS, MOCK_LEADERBOARD, MOCK_EVENTS, MOCK_NOTIFICATIONS, MOCK_VISIBILITY_SETTINGS, MOCK_RULES_DATA } from '../mockData';

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
      {apiBase === 'firebase' && (
        <div className="mt-3">
          <button
            onClick={async () => {
              if (!confirm('Seed Firebase with mock data? This will overwrite existing data for teams/events/users/visibility/notifications/rules.')) return;
              try {
                // Convert teams array to map by id for DB
                const teamsMap: any = {};
                (MOCK_LEADERBOARD || []).forEach((t: any) => teamsMap[t.id] = t);
                await writeToFirebaseData('teams', teamsMap);
                await writeToFirebaseData('users', INITIAL_MOCK_USERS);
                const eventsMap: any = {};
                (MOCK_EVENTS || []).forEach((e: any) => eventsMap[e.id] = e);
                await writeToFirebaseData('events', eventsMap);
                await writeToFirebaseData('notifications', MOCK_NOTIFICATIONS || []);
                await writeToFirebaseData('visibility', MOCK_VISIBILITY_SETTINGS || {});
                await writeToFirebaseData('rules', MOCK_RULES_DATA || {});
                alert('Seed complete — refresh the page to load data.');
              } catch (err) {
                console.error('Seeding Firebase failed', err);
                alert('Seeding failed — check console for details.');
              }
            }}
            className="mt-2 px-2 py-1 bg-indigo-600 text-white rounded text-sm"
          >
            Seed Firebase (mock)
          </button>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
