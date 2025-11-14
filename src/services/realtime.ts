import Pusher from 'pusher-js';

type Callback = (data: any) => void;

let pusher: Pusher | null = null;
const subscriptions: Record<string, { channel: Pusher.Channel | null; events: Record<string, Callback[]> }> = {};

export function initRealtime() {
  if (typeof window === 'undefined') return null;
  const key = (import.meta as any).env?.VITE_PUSHER_KEY as string | undefined;
  const cluster = (import.meta as any).env?.VITE_PUSHER_CLUSTER as string | undefined;
  if (!key || !cluster) {
    console.warn('[realtime] VITE_PUSHER_KEY or VITE_PUSHER_CLUSTER not set. Realtime disabled.');
    return null;
  }
  if (!pusher) {
    pusher = new Pusher(key, { cluster, forceTLS: true });
  }
  return pusher;
}

export function subscribe(channelName: string, eventName: string, cb: Callback) {
  const p = initRealtime();
  if (!p) return () => {};

  if (!subscriptions[channelName]) {
    const ch = p.subscribe(channelName);
    subscriptions[channelName] = { channel: ch, events: {} };
  }
  const sub = subscriptions[channelName];
  if (!sub.events[eventName]) sub.events[eventName] = [];
  sub.events[eventName].push(cb);
  sub.channel?.bind(eventName, cb);

  return () => {
    // unsubscribe callback
    const idx = sub.events[eventName].indexOf(cb);
    if (idx > -1) sub.events[eventName].splice(idx, 1);
    sub.channel?.unbind(eventName, cb);
    // if no events left on channel, unsubscribe entirely
    const hasAny = Object.values(sub.events).some(arr => arr.length > 0);
    if (!hasAny && sub.channel) {
      p.unsubscribe(channelName);
      delete subscriptions[channelName];
    }
  };
}

export function shutdownRealtime() {
  if (!pusher) return;
  Object.keys(subscriptions).forEach(ch => {
    const s = subscriptions[ch];
    if (s.channel) {
      pusher?.unsubscribe(ch);
    }
  });
  pusher.disconnect();
  pusher = null;
}
