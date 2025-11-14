import React, { useState, useEffect } from 'react';
import { initFirebase, publishMessage, subscribeToChannel } from '../services/firebase';

const FirebaseDemo: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const [messages, setMessages] = useState<{ event: string; data: any; timestamp: string }[]>([]);
  const [channelName, setChannelName] = useState('sims-realtime');
  const [eventName, setEventName] = useState('data-update');
  const [publishPayload, setPublishPayload] = useState('{"status":"active","lastUpdated":"now"}');
  const [status, setStatus] = useState('Initializing...');
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  useEffect(() => {
    // Initialize Firebase once on mount
    const db = initFirebase();
    if (db) {
      setInitialized(true);
      setStatus('✓ Firebase Realtime Database connected');
    } else {
      setStatus('❌ Firebase not configured. Add credentials to .env.production');
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const handleSubscribe = () => {
    if (!initialized) {
      setStatus('Firebase not initialized');
      return;
    }

    // Unsubscribe from previous listener if exists
    if (unsubscribe) {
      unsubscribe();
    }

    // Subscribe to new channel
    const unsub = subscribeToChannel(channelName, eventName, (data) => {
      setMessages((prev) => [
        ...prev.slice(-19), // Keep last 20 messages
        {
          event: eventName,
          data,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    });

    setUnsubscribe(() => unsub);
    setStatus(`✓ Listening to "${channelName}" → "${eventName}"`);
  };

  const handlePublish = async () => {
    if (!initialized) {
      setStatus('Firebase not initialized');
      return;
    }

    try {
      let payload: any = {};
      try {
        payload = JSON.parse(publishPayload);
      } catch {
        setStatus('✗ Invalid JSON payload');
        return;
      }

      await publishMessage(channelName, eventName, payload);
      setStatus(`📤 Published to "${channelName}" → "${eventName}"`);
    } catch (err: any) {
      setStatus(`✗ Publish error: ${err.message}`);
    }
  };

  const clearMessages = () => setMessages([]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 space-y-4">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Firebase Realtime Test</h2>

      {/* Status */}
      <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
        Status: {status}
      </div>

      {/* Channel & Event Config */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Channel Name
          </label>
          <input
            type="text"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Event Name
          </label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            JSON Payload to Publish
          </label>
          <textarea
            value={publishPayload}
            onChange={(e) => setPublishPayload(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleSubscribe}
          disabled={!initialized}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded font-medium transition"
        >
          Subscribe
        </button>
        <button
          onClick={handlePublish}
          disabled={!initialized}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded font-medium transition"
        >
          Publish
        </button>
        <button
          onClick={clearMessages}
          className="px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white rounded font-medium transition"
        >
          Clear Messages
        </button>
      </div>

      {/* Messages Display */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded p-4 space-y-2 max-h-96 overflow-y-auto">
        <h3 className="font-semibold text-slate-900 dark:text-white">Received Messages ({messages.length}):</h3>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">No messages yet...</p>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-700 p-2 rounded text-xs font-mono border-l-4 border-blue-500">
              <div className="text-slate-500 dark:text-slate-400">{msg.timestamp}</div>
              <div className="text-slate-700 dark:text-slate-300">Event: {msg.event}</div>
              <div className="text-slate-900 dark:text-white whitespace-pre-wrap break-all">
                {JSON.stringify(msg.data, null, 2)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-3 text-sm">
        <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">How to Test:</h4>
        <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
          <li>Create a Firebase project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline">https://console.firebase.google.com</a></li>
          <li>Enable Realtime Database in your project</li>
          <li>Get your Firebase config and add to .env.local (see instructions below)</li>
          <li>Open this page in two tabs or devices</li>
          <li>In Tab A: Click "Subscribe" to listen for events</li>
          <li>In Tab B: Change channel/event names and click "Publish"</li>
          <li>Messages appear instantly in Tab A</li>
        </ol>
      </div>
    </div>
  );
};

export default FirebaseDemo;
