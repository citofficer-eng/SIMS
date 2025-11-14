import React from 'react';
import FirebaseDemo from '../components/FirebaseDemo';

const RealtimeTest: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Firebase Realtime Testing</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Test Firebase Realtime Database publish/subscribe. Open this page in multiple tabs or devices to see messages propagate in real-time across all clients.
          </p>
        </div>

        <FirebaseDemo />

        <div className="mt-8 bg-slate-100 dark:bg-slate-800 rounded p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Setup Instructions</h2>
          <ol className="list-decimal list-inside space-y-3 text-slate-700 dark:text-slate-300">
            <li>
              Create a Firebase project at{' '}
              <a
                href="https://console.firebase.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                https://console.firebase.google.com
              </a>
            </li>
            <li>
              In your project:
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Go to <strong>Build</strong> → <strong>Realtime Database</strong></li>
                <li>Click <strong>Create Database</strong></li>
                <li>Choose location and start in <strong>test mode</strong> (for development)</li>
              </ul>
            </li>
            <li>
              In <strong>Project Settings</strong>, copy your web app config. Add to <code className="bg-white dark:bg-slate-900 px-2 py-1 rounded">.env.local</code>:
              <pre className="bg-white dark:bg-slate-900 p-3 rounded mt-2 text-sm overflow-x-auto break-words whitespace-pre-wrap">
{`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com`}
              </pre>
            </li>
            <li>Restart dev server: <code className="bg-white dark:bg-slate-900 px-2 py-1 rounded">npm run dev</code></li>
            <li>
              Open this page in multiple tabs/browsers:
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>In Tab A: Click "Subscribe" on a channel</li>
                <li>In Tab B: Publish a message to the same channel</li>
                <li>Watch Tab A receive the message in real-time ✨</li>
              </ul>
            </li>
          </ol>
        </div>

        <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded p-4">
          <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">✓ Cross-Device Sync</h3>
          <p className="text-sm text-green-800 dark:text-green-200">
            Changes made on any device are instantly visible on all other connected devices because Firebase Realtime Database syncs all clients automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RealtimeTest;
