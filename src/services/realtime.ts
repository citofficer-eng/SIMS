// Pusher-based realtime integration has been removed in favor of Firebase Realtime
// This file remains as a small compatibility shim to avoid breaking imports.

export function initRealtime(): null {
  console.warn('[realtime] Pusher integration removed. Use Firebase Realtime via src/services/firebase.ts');
  return null;
}

export function subscribe(_channelName: string, _eventName: string, _cb: (data: any) => void) {
  // No-op: returns an unsubscribe function
  return () => {};
}

export function shutdownRealtime() {
  // No-op
}
