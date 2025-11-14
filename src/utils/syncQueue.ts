import { updateVisibilitySettings, updateRules, addPointLog, updateEvent, logActivity, updateTeam } from '../services/api';

const QUEUE_KEY = 'sims_sync_queue_v1';

  type SyncAction = {
  id: string;
  type: 'visibility:update' | 'rules:update' | 'point:add' | 'event:update' | 'activity:log' | 'team:update';
  payload: any;
  attempts: number;
  createdAt: string;
  nextAttemptAt?: string | null;
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
  const action: SyncAction = { id: `act_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, type, payload, attempts: 0, createdAt: new Date().toISOString(), nextAttemptAt: null };
  q.push(action);
  writeQueue(q);
};

export const getQueue = (): SyncAction[] => {
  return readQueue();
};

export const getQueueStats = () => {
  const q = readQueue();
  const pending = q.length;
  const nextTimes = q.map(a => a.nextAttemptAt ? new Date(a.nextAttemptAt).getTime() : Infinity).filter(Boolean);
  const nextAttemptAt = nextTimes.length ? new Date(Math.min(...nextTimes)).toISOString() : null;
  return { pending, nextAttemptAt };
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 1000; // base backoff
const JITTER_MS = 300;

export const processQueue = async (opts?: { onProgress?: (remaining: number) => void }) => {
  const fullQueue = readQueue();
  if (!fullQueue.length) return;

  const now = Date.now();
  const eligible = fullQueue.filter(a => !a.nextAttemptAt || new Date(a.nextAttemptAt).getTime() <= now);
  const ineligible = fullQueue.filter(a => a.nextAttemptAt && new Date(a.nextAttemptAt).getTime() > now);

  if (!eligible.length) return; // nothing due to run

  const remainingAfter: SyncAction[] = [];

  for (const action of eligible) {
    try {
      if (action.type === 'visibility:update') {
        // Conflict-aware update: fetch remote and compare versions when possible
        try {
          const remote = await (await import('../services/api')).getVisibilitySettings();
          const remoteVersion = remote?.version || 0;
          const localVersion = action.payload?.version || 0;
          if (remoteVersion > localVersion) {
            // remote is newer - skip applying to avoid overwrite
            console.warn('Skipping visibility update due to newer server version');
            continue;
          }
        } catch (e) {
          // ignore and attempt update
        }
        await updateVisibilitySettings(action.payload);
      } else if (action.type === 'rules:update') {
        await updateRules(action.payload);
      } else if (action.type === 'point:add') {
        await addPointLog(action.payload);
      } else if (action.type === 'team:update') {
        await updateTeam(action.payload);
      } else if (action.type === 'event:update') {
        await updateEvent(action.payload);
      } else if (action.type === 'activity:log') {
        await logActivity(action.payload.userId, action.payload.action, action.payload.target);
      }
      // success -> continue
    } catch (err) {
      console.warn('Sync action failed, will retry later', action.type, err);
      action.attempts = (action.attempts || 0) + 1;
      if (action.attempts < MAX_ATTEMPTS) {
        // exponential backoff with jitter
        const backoff = BASE_DELAY_MS * Math.pow(2, action.attempts - 1);
        const jitter = Math.floor(Math.random() * JITTER_MS);
        action.nextAttemptAt = new Date(Date.now() + backoff + jitter).toISOString();
        remainingAfter.push(action);
      } else {
        console.warn('Dropping sync action after max attempts', action.id, action.type);
      }
    }
    if (opts?.onProgress) opts.onProgress(fullQueue.length - 1);
    // small pause between items
    await delay(200);
  }

  // merge remainingAfter (retries) with ineligible (not yet due)
  const finalQueue = remainingAfter.concat(ineligible);
  writeQueue(finalQueue);
};

export const clearQueue = () => {
  try { localStorage.removeItem(QUEUE_KEY); } catch {}
};

export default { enqueue, processQueue, clearQueue };
