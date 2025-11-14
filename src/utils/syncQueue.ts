import { updateVisibilitySettings, updateRules, addPointLog, updateEvent, logActivity } from '../services/api';

const QUEUE_KEY = 'sims_sync_queue_v1';

type SyncAction = {
  id: string;
  type: 'visibility:update' | 'rules:update' | 'point:add' | 'event:update' | 'activity:log';
  payload: any;
  attempts: number;
  createdAt: string;
};

const readQueue = (): SyncAction[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read sync queue', e);
    return [];
  }
};

const writeQueue = (q: SyncAction[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch (e) {
    console.error('Failed to write sync queue', e);
  }
};

export const enqueue = (type: SyncAction['type'], payload: any) => {
  const q = readQueue();
  const action: SyncAction = { id: `act_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, type, payload, attempts: 0, createdAt: new Date().toISOString() };
  q.push(action);
  writeQueue(q);
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const processQueue = async (opts?: { onProgress?: (remaining: number) => void }) => {
  let q = readQueue();
  if (!q.length) return;

  const remainingAfter: SyncAction[] = [];

  for (const action of q) {
    try {
      if (action.type === 'visibility:update') {
        await updateVisibilitySettings(action.payload);
      } else if (action.type === 'rules:update') {
        await updateRules(action.payload);
      } else if (action.type === 'point:add') {
        await addPointLog(action.payload);
      } else if (action.type === 'event:update') {
        await updateEvent(action.payload);
      } else if (action.type === 'activity:log') {
        await logActivity(action.payload.userId, action.payload.action, action.payload.target);
      }
      // success -> continue
    } catch (err) {
      console.warn('Sync action failed, will retry later', action.type, err);
      action.attempts = (action.attempts || 0) + 1;
      // simple backoff: if attempts < 5, keep in queue, else drop
      if (action.attempts < 5) remainingAfter.push(action);
    }
    if (opts?.onProgress) opts.onProgress(readQueue().length - 1);
    // small pause between items
    await delay(200);
  }

  writeQueue(remainingAfter);
};

export const clearQueue = () => {
  try { localStorage.removeItem(QUEUE_KEY); } catch {}
};

export default { enqueue, processQueue, clearQueue };
