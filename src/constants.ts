import { UserRole } from './types.ts';

// For real backend (PHP)
// Prefer using `VITE_API_BASE` environment variable in development to point
// directly at the backend (example: VITE_API_BASE="http://localhost/SIMS4/api").
// When deployed to a static host (like Firebase Hosting or GitHub Pages) we cannot run PHP,
// so default to the mock API if the host is github.io, firebase.web.app, or VITE_API_BASE is set to '/mock'.
const envApiBase = ((import.meta as any).env?.VITE_API_BASE as string) || '';
const isGithubPages = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
const isFirebaseHosting = typeof window !== 'undefined' && window.location.hostname.endsWith('web.app');
export const API_BASE = envApiBase === '/mock' || (!envApiBase && (isGithubPages || isFirebaseHosting))
  ? '/mock'
  : (envApiBase || (typeof window !== 'undefined' ? window.location.origin + '/api' : '/api'));

console.log('[API] Detected hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');
console.log('[API] Is Firebase:', isFirebaseHosting);
console.log('[API] API_BASE:', API_BASE);

export const ROLES = {
  USER: UserRole.USER,
  OFFICER: UserRole.OFFICER,
  ADMIN: UserRole.ADMIN,
};

export const AMARANTH_JOKERS_TEAM_ID = 't5';

// "scripts": {
//   "predeploy": "npm run build",
//   "deploy": "gh-pages -d dist"
// }
