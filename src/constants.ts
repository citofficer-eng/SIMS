import { UserRole } from './types.ts';

// For real backend (PHP)
// Prefer using `VITE_API_BASE` environment variable in development to point
// directly at the backend (example: VITE_API_BASE="http://localhost/SIMS4/api").
// When deployed to a static host (like Firebase Hosting or GitHub Pages) we cannot run PHP,
// so default to the mock API if the host is github.io, firebase.web.app, or VITE_API_BASE is set to '/mock'.

// IMPORTANT: This function is called dynamically to ensure we always check the current hostname
export function getApiBase(): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isGithubPages = hostname.endsWith('github.io');
  const isFirebaseHosting = hostname.endsWith('web.app');
  const envApiBase = ((import.meta as any).env?.VITE_API_BASE as string) || '';
  
  console.log('[API] Detected hostname:', hostname);
  console.log('[API] Is GitHub Pages:', isGithubPages);
  console.log('[API] Is Firebase Hosting:', isFirebaseHosting);
  console.log('[API] Env VITE_API_BASE:', envApiBase);
  
  // Priority: 1. Env file (including 'firebase' mode), 2. GitHub Pages/Firebase detection, 3. Default to backend
  // If env explicitly requests firebase, or we're on Firebase Hosting, use firebase mode
  if (envApiBase === 'firebase' || (!envApiBase && isFirebaseHosting)) {
    console.log('[API] Using Firebase mode');
    return 'firebase';
  }

  const result = envApiBase === '/mock' || (!envApiBase && isGithubPages)
    ? '/mock'
    : (envApiBase || (typeof window !== 'undefined' ? window.location.origin + '/api' : '/api'));
  
  console.log('[API] Final API_BASE:', result);
  return result;
}

// Call once on module load for initial logging
getApiBase();

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
