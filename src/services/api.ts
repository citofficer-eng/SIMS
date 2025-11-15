import { getApiBase } from '../constants.ts';
import { User, UserRole, Team, Event, Report, PointLog, ReportReply, Roster, RulesData, EventResult, AppNotification, Activity, VisibilitySettings, JoinRequest, EventStatus, EventCategory, CriteriaItem, ScoreAdjustment } from '../types.ts';

// --- MOCK DATA & STORAGE ---
const STORAGE_KEYS = {
    USERS: 'sims_users',
    TEAMS: 'sims_teams',
    EVENTS: 'sims_events_v2',
    NOTIFICATIONS: 'sims_notifications',
    REPORTS: 'sims_reports',
    RULES: 'sims_rules',
    ACTIVITIES: 'sims_activities',
    VISIBILITY: 'sims_visibility_settings'
};

// Firebase listener map for real-time updates
const firebaseListeners: Map<string, () => void> = new Map();

// In-memory store initialized from local storage or defaults
const getStoredData = <T>(key: string, defaultValue: T): T => {
    const stored = localStorage.getItem(key);
    try {
        return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
        console.error("Failed to parse stored data for key:", key);
        return defaultValue;
    }
};

const setStoredData = <T>(key: string, data: T) => {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('storage-update', { detail: { key } }));
};

// Firebase DB helper (browser-safe dynamic import)
const getFirebaseDB = async () => {
    try {
        const mod = await import('./firebase');
        const db = mod.initFirebase();
        if (db) {
            console.log('[Firebase] Database initialized successfully');
        } else {
            console.warn('[Firebase] Database initialization returned null');
        }
        return db;
    } catch (e) {
        console.error('[Firebase] Failed to initialize database:', e);
        return null;
    }
};

const getOnceFromFirebase = async <T>(path: string): Promise<T | null> => {
    try {
        const db = await getFirebaseDB();
        if (!db) return null;
        const { ref, get } = await import('firebase/database');
        const dbRef = ref(db, path);
        const snap = await get(dbRef);
        return snap.exists() ? snap.val() : null;
    } catch (e) {
        console.warn('Firebase getOnce failed for', path, e);
        return null;
    }
};

const subscribeToFirebaseData = <T>(path: string, callback: (data: T) => void): (() => void) => {
    let cancelled = false;
    let unsubscribeFn: () => void = () => { cancelled = true; };

    (async () => {
        try {
            const db = await getFirebaseDB();
            if (!db) {
                console.error(`[Firebase] DB not initialized for subscription to ${path}`);
                return;
            }
            const { ref, onValue, off } = await import('firebase/database');
            const dbRef = ref(db, path);
            console.log(`[Firebase] Subscribing to path: ${path}`);
            const listener = (snapshot: any) => {
                if (snapshot.exists()) {
                    const val = snapshot.val();
                    console.log(`[Firebase] Data received for ${path}:`, val);
                    callback(val);
                    try { lastReceivedTimestamps[path] = new Date().toISOString(); } catch (e) {}
                } else {
                    console.warn(`[Firebase] No data exists at path: ${path}`);
                }
            };
            onValue(dbRef, listener, (error: any) => {
                console.error(`[Firebase] Subscription error for ${path}:`, error);
            });
            unsubscribeFn = () => { try { off(dbRef, 'value', listener); } catch (e) {} };
            if (cancelled) {
                // If unsubscribed before listener attached, clean up immediately
                unsubscribeFn();
            }
            firebaseListeners.set(path, unsubscribeFn);
        } catch (e) {
            console.error(`[Firebase] Subscription failed for ${path}:`, e);
        }
    })();

    return () => {
        cancelled = true;
        try { unsubscribeFn(); } catch (e) {}
    };
};

const writeToFirebaseData = async <T>(path: string, data: T): Promise<void> => {
    try {
        const db = await getFirebaseDB();
        if (!db) return Promise.resolve();
        const { ref, set } = await import('firebase/database');
        const dbRef = ref(db, path);
        // Firebase Realtime Database does not accept `undefined` values.
        // Serialize through JSON to strip undefined and produce a safe payload.
        let safe: any;
        try {
            safe = JSON.parse(JSON.stringify(data));
        } catch (e) {
            // fallback: attempt shallow copy
            safe = data as any;
        }
        return set(dbRef, safe);
    } catch (e) {
        console.warn('Firebase write failed for', path, e);
        return Promise.resolve();
    }
};

// --- MOCK DATA ---
import { INITIAL_MOCK_USERS, MOCK_LEADERBOARD, MOCK_EVENTS, MOCK_REPORTS, MOCK_NOTIFICATIONS, MOCK_VISIBILITY_SETTINGS, MOCK_RULES_DATA } from '../mockData.ts';

// Initialize mock data state
let usersStore = getStoredData<{ [id: string]: User }>(STORAGE_KEYS.USERS, INITIAL_MOCK_USERS);
let teamsStore = getStoredData<Team[]>(STORAGE_KEYS.TEAMS, MOCK_LEADERBOARD);
let eventsStore = getStoredData<Event[]>(STORAGE_KEYS.EVENTS, MOCK_EVENTS);
let reportsStore = getStoredData<Report[]>(STORAGE_KEYS.REPORTS, MOCK_REPORTS);
let notificationStore = getStoredData<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, MOCK_NOTIFICATIONS);
let rulesStore = getStoredData<RulesData>(STORAGE_KEYS.RULES, MOCK_RULES_DATA);

// Bind API_BASE at module initialization for convenience (keeps older code working)
const API_BASE = getApiBase();
let visibilityStore = getStoredData<VisibilitySettings>(STORAGE_KEYS.VISIBILITY, MOCK_VISIBILITY_SETTINGS);
let activityStore = getStoredData<Activity[]>(STORAGE_KEYS.ACTIVITIES, []);

// Helper to broadcast notification
const broadcastNotification = (title: string, message: string, link: string, type: AppNotification['type']) => {
    const newNotification: AppNotification = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title, message, timestamp: new Date().toISOString(), link, type
    };
    notificationStore.unshift(newNotification);
    if (notificationStore.length > 50) notificationStore = notificationStore.slice(0, 50);
    setStoredData(STORAGE_KEYS.NOTIFICATIONS, notificationStore);
};

// --- MOCK API IMPLEMENTATION ---
const mockApi = {
    getActivities: (): Promise<Activity[]> => Promise.resolve(activityStore),
    logActivity: (userId: string, action: string, target?: Activity['target']): Promise<void> => {
        const entry: Activity = { id: `act_${Date.now()}`, userId, action, target, timestamp: new Date().toISOString() } as Activity;
        activityStore.unshift(entry);
        if (activityStore.length > 200) activityStore = activityStore.slice(0, 200);
        setStoredData(STORAGE_KEYS.ACTIVITIES, activityStore);
        return Promise.resolve();
    },
    login: (email: string, pass: string): Promise<User> => new Promise((resolve, reject) => {
        setTimeout(() => {
            const user = Object.values(usersStore).find(u => u.email.toLowerCase() === email.toLowerCase());
            if (user && user.password === pass) {
                try { localStorage.setItem('token', 'mock-jwt-token'); } catch {}
                resolve(user);
            }
            else if (user) reject(new Error('Invalid credentials'));
            else reject(new Error('User not found'));
        }, 300);
    }),

    loginWithGoogle: (googleData: { idToken: string }): Promise<{ user: User, isNew: boolean }> => new Promise((resolve) => {
        setTimeout(() => {
            // This is a simplified mock. In a real app, you'd verify the token.
            const mockEmail = "new.user@google.com";
            const existingUser = Object.values(usersStore).find(u => u.email.toLowerCase() === mockEmail);
            if (existingUser) {
                try { localStorage.setItem('token', 'mock-jwt-token'); } catch {}
                resolve({ user: existingUser, isNew: false });
            } else {
                const partialUser: User = {
                    id: `google_${Date.now()}`,
                    email: mockEmail,
                    firstName: "Google",
                    lastName: "User",
                    name: "Google User",
                    role: UserRole.USER,
                    avatar: `https://robohash.org/${mockEmail}.png`
                };
                try { localStorage.setItem('token', 'mock-jwt-token'); } catch {}
                resolve({ user: partialUser, isNew: true });
            }
        }, 300);
    }),

    completeUserProfile: (userData: User): Promise<{ user: User }> => new Promise((resolve) => {
        setTimeout(() => {
            usersStore[userData.id] = { ...usersStore[userData.id], ...userData, name: `${userData.firstName} ${userData.lastName}` };
            setStoredData(STORAGE_KEYS.USERS, usersStore);
            resolve({ user: usersStore[userData.id] });
        }, 300);
    }),

    register: (userData: Partial<User>): Promise<{ user: User, token: string }> => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Object.values(usersStore).find(u => u.email.toLowerCase() === (userData.email || '').toLowerCase())) {
                return reject(new Error('Email already exists'));
            }
            const newUser: User = {
                id: `user_${Date.now()}`,
                name: `${userData.firstName} ${userData.lastName}`,
                role: UserRole.USER,
                avatar: userData.avatar || 'https://i.pravatar.cc/150',
                ...userData,
            } as User;
            usersStore[newUser.id] = newUser;
            setStoredData(STORAGE_KEYS.USERS, usersStore);
            try { localStorage.setItem('token', 'mock-jwt-token'); } catch {}
            resolve({ user: newUser, token: "mock-jwt-token" });
        }, 300);
    }),

    getUsers: (): Promise<User[]> => Promise.resolve(Object.values(usersStore)),
    updateUserRole: (userId: string, role: UserRole): Promise<User> => {
        usersStore[userId].role = role;
        setStoredData(STORAGE_KEYS.USERS, usersStore);
        return Promise.resolve(usersStore[userId]);
    },
    getLeaderboard: (): Promise<Team[]> => {
        const updatedTeams = teamsStore.map(team => ({
          ...team,
          playersCount: Object.values(usersStore).filter(u => u.teamId === team.id).length
        }));
        return Promise.resolve(updatedTeams);
    },
    updateTeam: (teamData: Partial<Team>): Promise<Team> => {
        const teamIndex = teamsStore.findIndex(t => t.id === teamData.id);
        if (teamIndex > -1) {
            teamsStore[teamIndex] = { ...teamsStore[teamIndex], ...teamData };
            setStoredData(STORAGE_KEYS.TEAMS, teamsStore);
            // Write to Firebase
            writeToFirebaseData(`teams/${teamData.id}`, teamsStore[teamIndex]).catch(e => console.warn('Firebase team update failed', e));
            return Promise.resolve(teamsStore[teamIndex]);
        }
        return Promise.reject(new Error("Team not found"));
    },

    getEvents: (): Promise<Event[]> => Promise.resolve(eventsStore),
    addEvent: (eventData: Partial<Event>): Promise<Event> => {
        const newEvent: Event = { id: `evt_${Date.now()}`, ...eventData } as Event;
        eventsStore.push(newEvent);
        setStoredData(STORAGE_KEYS.EVENTS, eventsStore);
        return Promise.resolve(newEvent);
    },
    updateEvent: (eventData: Event): Promise<Event> => {
        const index = eventsStore.findIndex(e => e.id === eventData.id);
        if (index > -1) {
            eventsStore[index] = { ...eventsStore[index], ...eventData };
            setStoredData(STORAGE_KEYS.EVENTS, eventsStore);
            return Promise.resolve(eventsStore[index]);
        }
        return Promise.reject(new Error("Event not found"));
    },
    deleteEvent: (eventId: string): Promise<void> => {
        eventsStore = eventsStore.filter(e => e.id !== eventId);
        setStoredData(STORAGE_KEYS.EVENTS, eventsStore);
        return Promise.resolve();
    },

    updateEventResults: (eventId: string, results: EventResult[]): Promise<Event> => {
        const eventIdx = eventsStore.findIndex(e => e.id === eventId);
        if (eventIdx === -1) return Promise.reject(new Error("Event not found"));
        const event = eventsStore[eventIdx];
        event.results = results;
        event.status = EventStatus.COMPLETED;
        // ... (complex score calculation logic from old api.ts)
        setStoredData(STORAGE_KEYS.EVENTS, eventsStore);
        setStoredData(STORAGE_KEYS.TEAMS, teamsStore); // Assuming teamsStore is mutated by logic
        return Promise.resolve(event);
    },

    getNotifications: (): Promise<AppNotification[]> => Promise.resolve(notificationStore),
    
    addPointLog: (log: { teamId: string, type: 'merit' | 'demerit', reason: string, points: number }): Promise<void> => {
        const team = teamsStore.find(t => t.id === log.teamId);
        if (team) {
            const logEntry: PointLog = { id: `log_${Date.now()}`, updatedBy: 'Admin', timestamp: new Date().toISOString(), ...log };
            const previousScore = team.score || 0;
            if (log.type === 'merit') {
                team.merits = [...(team.merits || []), logEntry];
                team.score += log.points;
            } else {
                team.demerits = [...(team.demerits || []), logEntry];
                team.score -= log.points;
            }
            // Update detailed progress history
            team.detailedProgressHistory = team.detailedProgressHistory || [];
            team.detailedProgressHistory.push({
                timestamp: logEntry.timestamp,
                score: team.score,
                reason: log.reason,
                change: team.score - previousScore
            });
            // Update simple progress history
            team.progressHistory = team.progressHistory || [];
            team.progressHistory.push({ date: logEntry.timestamp, score: team.score });
            setStoredData(STORAGE_KEYS.TEAMS, teamsStore);
            // Write to Firebase
            writeToFirebaseData(`teams/${team.id}`, team).catch(e => console.warn('Firebase point log update failed', e));
        }
        return Promise.resolve();
    },
    deletePointLog: (logId: string): Promise<void> => {
        // Find which team and which log type it belongs to, then remove and adjust score
        return Promise.resolve();
    },
    updatePointLog: (logId: string, updatedLog: Partial<PointLog> & { teamId: string }): Promise<void> => {
        // Find and update the log, then recalculate score
        return Promise.resolve();
    },
    
    getReports: (): Promise<Report[]> => Promise.resolve(reportsStore),
    submitReport: (reportData: any): Promise<void> => {
        const newReport: Report = { id: `rep_${Date.now()}`, timestamp: new Date().toISOString(), status: 'pending', ...reportData };
        reportsStore.unshift(newReport);
        setStoredData(STORAGE_KEYS.REPORTS, reportsStore);
        return Promise.resolve();
    },
    updateReportStatus: (reportId: string, status: Report['status']): Promise<void> => {
        const report = reportsStore.find(r => r.id === reportId);
        if (report) {
            report.status = status;
            setStoredData(STORAGE_KEYS.REPORTS, reportsStore);
        }
        return Promise.resolve();
    },
    addReportReply: (reportId: string, reply: { reply: string }): Promise<void> => {
        const report = reportsStore.find(r => r.id === reportId);
        if (report) {
            const newReply: ReportReply = { id: `reply_${Date.now()}`, message: reply.reply, repliedBy: '1', timestamp: new Date().toISOString() };
            report.replies = [...(report.replies || []), newReply];
            setStoredData(STORAGE_KEYS.REPORTS, reportsStore);
        }
        return Promise.resolve();
    },

    getTeamUsers: (teamId: string): Promise<User[]> => Promise.resolve(Object.values(usersStore).filter(user => user.teamId === teamId)),

    requestToJoinTeam: (teamId: string): Promise<void> => new Promise((resolve, reject) => {
        const team = teamsStore.find(t => t.id === teamId);
        if (team) {
            team.joinRequests = team.joinRequests || [];
            // Assume user ID '3' is making the request for mock purposes
            if (team.joinRequests.some(r => r.userId === '3')) {
                return reject(new Error("You have already sent a request to join this team."));
            }
            team.joinRequests.push({ id: `req_${Date.now()}`, userId: '3', timestamp: new Date().toISOString() });
            setStoredData(STORAGE_KEYS.TEAMS, teamsStore);
            resolve();
        } else {
            reject(new Error("Team not found"));
        }
    }),
    
    manageJoinRequest: (teamId: string, userId: string, action: 'accepted' | 'rejected'): Promise<void> => {
        const team = teamsStore.find(t => t.id === teamId);
        if (team) {
            team.joinRequests = team.joinRequests?.filter(r => r.userId !== userId);
            if (action === 'accepted') {
                usersStore[userId].teamId = teamId;
                setStoredData(STORAGE_KEYS.USERS, usersStore);
            }
            setStoredData(STORAGE_KEYS.TEAMS, teamsStore);
        }
        return Promise.resolve();
    },
    
    removeUserFromTeam: (userId: string): Promise<void> => {
        if(usersStore[userId]) {
            usersStore[userId].teamId = undefined;
            setStoredData(STORAGE_KEYS.USERS, usersStore);
        }
        return Promise.resolve();
    },

    updateTeamRoster: (teamId: string, eventId: string, participants: string[]): Promise<void> => {
        const team = teamsStore.find(t => t.id === teamId);
        if (team) {
            team.rosters = team.rosters || [];
            const rosterIndex = team.rosters.findIndex(r => r.eventId === eventId);
            if (rosterIndex > -1) {
                team.rosters[rosterIndex].participants = participants;
            } else {
                team.rosters.push({ eventId, participants });
            }
            setStoredData(STORAGE_KEYS.TEAMS, teamsStore);
        }
        return Promise.resolve();
    },

    getVisibilitySettings: (): Promise<VisibilitySettings> => Promise.resolve(visibilityStore),
    updateVisibilitySettings: (settings: VisibilitySettings): Promise<void> => {
        visibilityStore = settings;
        setStoredData(STORAGE_KEYS.VISIBILITY, visibilityStore);
        return Promise.resolve();
    },
    
    getRules: (): Promise<RulesData> => Promise.resolve(rulesStore),
    updateRules: (rulesData: RulesData): Promise<void> => {
        rulesStore = rulesData;
        setStoredData(STORAGE_KEYS.RULES, rulesStore);
        return Promise.resolve();
    },
};

// --- API HELPERS (for real API) ---
const withMockFallback = async <T,>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> => {
  try {
    return await apiFn();
  } catch (error) {
    console.warn('[API] Backend failed, falling back to mock:', error);
    try {
      return await mockFn();
    } catch (mockError) {
      throw error; // Throw the original error
    }
  }
};

const apiFetch = async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  
  const url = `${API_BASE}${endpoint}`;
  console.log(`[API] ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, { ...options, headers });
  
    if (!response.ok) {
        let errorMessage = `API error: ${response.statusText}`;
        try {
            const responseText = await response.text();
            const snippet = responseText.substring(0, 500).replace(/\s+/g, ' ');
            // If response looks like PHP source or an HTML error page, surface a clearer error
            if (responseText.includes('<?php') || responseText.trim().startsWith('<')) {
                console.error('[API] Backend returned non-JSON response (likely PHP/HTML).');
                console.error('[API] Response snippet:', snippet);
                errorMessage = `Backend returned non-JSON response. Snippet: ${snippet}`;
            } else {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.message || errorData.error || errorMessage;
            }
        } catch (e) {
            // If we can't parse or read, just use the status message
        }
        throw new Error(errorMessage);
    }
  
    const responseText = await response.text();
    // If the response body begins with '<' it's probably HTML (PHP error page) not JSON
    if (responseText.trim().startsWith('<')) {
        const snippet = responseText.substring(0, 500).replace(/\s+/g, ' ');
        console.error('[API] Backend returned HTML/other non-JSON response. Snippet:', snippet);
        throw new Error(`Backend returned invalid JSON (probably an error page). Snippet: ${snippet}`);
    }
  
  if (response.status === 204) return null as T;
  return JSON.parse(responseText);
};

// --- EXPORTED API FUNCTIONS ---
export const login = async (email: string, pass: string): Promise<User> => {
    console.log('[API.login] API_BASE:', API_BASE);
    if (API_BASE === '/mock' || API_BASE === 'firebase') {
      console.log('[API.login] Using mock API');
      return mockApi.login(email, pass);
    }
    console.log('[API.login] Using real backend');
    try {
      const { user, token } = await apiFetch<{ token: string; user: User }>('/auth/login.php', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
      if (token) localStorage.setItem('token', token);
      return user;
    } catch (error) {
      console.warn('[API] Real backend failed, falling back to mock API');
      console.warn('[Error]:', error);
      // Fallback to mock API for development
      try {
        return await mockApi.login(email, pass);
      } catch (mockError) {
        throw error; // Throw the original error
      }
    }
};
export const loginWithGoogle = async (googleData: { idToken: string }): Promise<{ user: User, isNew: boolean }> => {
    if (API_BASE === '/mock' || API_BASE === 'firebase') return mockApi.loginWithGoogle(googleData);
    const { user, token, isNew } = await apiFetch<{ token: string, user: User, isNew: boolean }>('/auth/google.php', { method: 'POST', body: JSON.stringify(googleData) });
    if (token) localStorage.setItem('token', token);
    return { user, isNew };
};
export const completeUserProfile = async (userData: User): Promise<User> => {
    if (API_BASE === '/mock' || API_BASE === 'firebase') return (await mockApi.completeUserProfile(userData)).user;
    return (await apiFetch<{user: User}>('/auth/complete-profile.php', { method: 'PUT', body: JSON.stringify(userData) })).user;
};
export const register = async (userData: Partial<User>): Promise<User> => {
    if (API_BASE === '/mock' || API_BASE === 'firebase') return (await mockApi.register(userData)).user;
    try {
      const { user, token } = await apiFetch<{ token: string, user: User }>('/auth/register.php', { method: 'POST', body: JSON.stringify(userData) });
      if (token) localStorage.setItem('token', token);
      return user;
    } catch (error) {
      console.warn('[API] Real backend failed, falling back to mock API');
      console.warn('[Error]:', error);
      // Fallback to mock API for development
      try {
        return (await mockApi.register(userData)).user;
      } catch (mockError) {
        throw error; // Throw the original error
      }
    }
};
export const getCurrentUser = async (): Promise<User | null> => {
    if (API_BASE === '/mock' || API_BASE === 'firebase') {
        try {
            const stored = localStorage.getItem('user');
            if (!stored) return null;
            const parsed = JSON.parse(stored) as User;
            // find fresh copy in mock store
            const all = Object.values(getStoredData(STORAGE_KEYS.USERS, {} as any));
            const found = all.find((u: any) => u.id === parsed.id) || parsed;
            return found as User;
        } catch (e) {
            return null;
        }
    }

    try {
        return await apiFetch<User>('/auth/me.php');
    } catch (e) {
        console.warn('getCurrentUser failed', e);
        return null;
    }
};
export const getUsers = async (): Promise<User[]> => {
    if (API_BASE === '/mock') return mockApi.getUsers();
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('users');
        if (!snap) return [];
        return Object.values(snap) as User[];
    }
    return withMockFallback(
        () => apiFetch<User[]>('/users/get.php'),
        () => mockApi.getUsers()
    );
};
export const updateUserRole = (userId: string, role: UserRole): Promise<User> => API_BASE === '/mock' ? mockApi.updateUserRole(userId, role) : apiFetch<User>(`/users/update.php?id=${userId}`, { method: 'PUT', body: JSON.stringify({ role }) });
export const getLeaderboard = async (): Promise<Team[]> => {
    if (API_BASE === '/mock') return mockApi.getLeaderboard();
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('teams');
        if (!snap) return [];
        const teams = (Object.values(snap) as Team[]).map(t => ({
            ...t,
            progressHistory: (t as any).progressHistory || [],
            detailedProgressHistory: (t as any).detailedProgressHistory || [],
            merits: (t as any).merits || [],
            demerits: (t as any).demerits || [],
            score: (t as any).score || 0,
        }));
        // keep stable ordering (by score desc)
        teams.sort((a, b) => (b.score || 0) - (a.score || 0));
        return teams;
    }
    return withMockFallback(
        () => apiFetch<Team[]>('/teams/get.php'),
        () => mockApi.getLeaderboard()
    );
};
export const updateTeam = (teamData: Partial<Team>): Promise<Team> => API_BASE === '/mock' || API_BASE === 'firebase' ? mockApi.updateTeam(teamData) : apiFetch<Team>(`/teams/update.php?id=${teamData.id}`, { method: 'PUT', body: JSON.stringify(teamData) });
export const getEvents = async (): Promise<Event[]> => {
    if (API_BASE === '/mock') return mockApi.getEvents();
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('events');
        if (!snap) return [];
        const events = (Object.values(snap) as Event[]).map(e => ({
            ...e,
            startDate: (e as any).startDate || (e as any).date || null,
            date: (e as any).date || (e as any).startDate || null,
            status: (e as any).status || null,
        }));
        // Sort upcoming first by startDate (descending most recent first)
        events.sort((a, b) => {
            const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
            const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
            return tb - ta;
        });
        return events;
    }
    return withMockFallback(
        () => apiFetch<Event[]>('/events/get.php'),
        () => mockApi.getEvents()
    );
};
export const addEvent = async (eventData: Partial<Event>): Promise<Event> => {
    if (API_BASE === '/mock') return mockApi.addEvent(eventData);
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('events');
        const events = (snap ? Object.values(snap) : []) as Event[];
        const newEvent: Event = { id: `evt_${Date.now()}`, ...eventData } as Event;
        events.push(newEvent);
        await writeToFirebaseData('events', events).catch(e => console.warn('Firebase addEvent failed', e));
        setStoredData(STORAGE_KEYS.EVENTS, events);
        return newEvent;
    }
    return apiFetch<Event>('/events/create.php', { method: 'POST', body: JSON.stringify(eventData) });
};
export const updateEvent = async (eventData: Event): Promise<Event> => {
    if (API_BASE === '/mock') return mockApi.updateEvent(eventData);
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('events');
        const events = (snap ? Object.values(snap) : []) as Event[];
        const idx = events.findIndex(e => e.id === eventData.id);
        if (idx === -1) throw new Error('Event not found');
        events[idx] = { ...events[idx], ...eventData };
        await writeToFirebaseData('events', events).catch(e => console.warn('Firebase updateEvent failed', e));
        setStoredData(STORAGE_KEYS.EVENTS, events);
        return events[idx];
    }
    return apiFetch<Event>(`/events/update.php?id=${eventData.id}`, { method: 'PUT', body: JSON.stringify(eventData) });
};
export const deleteEvent = async (eventId: string): Promise<void> => {
    if (API_BASE === '/mock') return mockApi.deleteEvent(eventId);
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('events');
        const events = (snap ? Object.values(snap) : []) as Event[];
        const filtered = events.filter(e => e.id !== eventId);
        await writeToFirebaseData('events', filtered).catch(e => console.warn('Firebase deleteEvent failed', e));
        setStoredData(STORAGE_KEYS.EVENTS, filtered);
        return;
    }
    return apiFetch<void>(`/events/delete.php?id=${eventId}`, { method: 'DELETE' });
};
export const updateEventResults = async (eventId: string, results: EventResult[]): Promise<Event> => {
    if (API_BASE === '/mock') return mockApi.updateEventResults(eventId, results);
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('events');
        const events = (snap ? Object.values(snap) : []) as Event[];
        const idx = events.findIndex(e => e.id === eventId);
        if (idx === -1) throw new Error('Event not found');
        const event = events[idx];
        event.results = results;
        event.status = EventStatus.COMPLETED;
        // NOTE: complex score calculation may be required here; mimic mock behavior partially
        events[idx] = event;
        await writeToFirebaseData('events', events).catch(e => console.warn('Firebase updateEventResults failed', e));
        setStoredData(STORAGE_KEYS.EVENTS, events);
        // Optionally update teams if logic present elsewhere
        return event;
    }
    return apiFetch<Event>(`/events/results.php?id=${eventId}`, { method: 'PUT', body: JSON.stringify({ results }) });
};
export const getNotifications = async (): Promise<AppNotification[]> => {
    if (API_BASE === '/mock') return mockApi.getNotifications();
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('notifications');
        if (!snap) return [];
        return (Object.values(snap) as AppNotification[]);
    }
    return apiFetch<AppNotification[]>('/system/notifications.php');
};
export const logActivity = async (userId: string, action: string, target?: Activity['target']): Promise<void> => {
    if (API_BASE === '/mock') return mockApi.logActivity(userId, action, target);
    if (API_BASE === 'firebase') {
        try {
            const entry: Activity = { id: `act_${Date.now()}`, userId, action, target, timestamp: new Date().toISOString() } as Activity;
            const snap = await getOnceFromFirebase('activities');
            const list = (snap ? Object.values(snap) : []) as Activity[];
            list.unshift(entry);
            if (list.length > 500) list.length = 500;
            await writeToFirebaseData('activities', list).catch(e => console.warn('Firebase logActivity failed', e));
        } catch (e) {
            console.warn('logActivity firebase branch failed', e);
        }
        return Promise.resolve();
    }
    try {
        return await apiFetch<void>('/activities/index.php', { method: 'POST', body: JSON.stringify({ userId, action, target }) });
    } catch (e) {
        console.warn('logActivity failed', e);
        // fall back to console log to avoid blocking callers
        console.log(`Activity Log (queued): User ${userId} ${action}`, target || '');
    }
};
export const getAuditLogs = async (): Promise<Activity[]> => {
    if (API_BASE === '/mock') return mockApi.getActivities();
    if (API_BASE === 'firebase') {
        try {
            const snap = await getOnceFromFirebase('activities');
            return (snap ? Object.values(snap) as Activity[] : []);
        } catch (e) {
            console.warn('getAuditLogs firebase failed', e);
            return [];
        }
    }
    try {
        return await apiFetch<Activity[]>('/activities/index.php');
    } catch (e) {
        console.warn('getAuditLogs failed', e);
        return [];
    }
};
export const addPointLog = (log: { teamId: string, type: 'merit' | 'demerit', reason: string, points: number }): Promise<void> => API_BASE === '/mock' || API_BASE === 'firebase' ? mockApi.addPointLog(log) : apiFetch<void>('/points/index.php', { method: 'POST', body: JSON.stringify(log) });
export const deletePointLog = (logId: string): Promise<void> => API_BASE === '/mock' ? mockApi.deletePointLog(logId) : apiFetch<void>(`/points/delete.php?id=${logId}`, { method: 'DELETE' });
export const updatePointLog = (logId: string, updatedLog: Partial<PointLog> & { teamId: string }): Promise<void> => API_BASE === '/mock' ? mockApi.updatePointLog(logId, updatedLog) : apiFetch<void>(`/points/update.php?id=${logId}`, { method: 'PUT', body: JSON.stringify({ team_id: updatedLog.teamId, reason: updatedLog.reason, points: updatedLog.points }) });
export const getJoinRequests = async (teamId: string): Promise<JoinRequest[]> => {
    if (API_BASE === '/mock') {
        const team = teamsStore.find(t => t.id === teamId) as any;
        return (team && team.joinRequests) ? team.joinRequests : [];
    }
    if (API_BASE === 'firebase') {
        try {
            const snap = await getOnceFromFirebase(`teams/${teamId}/joinRequests`);
            return snap ? Object.values(snap) as JoinRequest[] : [];
        } catch (e) {
            console.warn('getJoinRequests firebase failed', e);
            return [];
        }
    }
    return apiFetch<JoinRequest[]>(`/teams/join_requests.php?teamId=${teamId}`);
};
export const requestToJoinTeam = async (teamId: string): Promise<void> => {
    if (API_BASE === '/mock') return mockApi.requestToJoinTeam(teamId);
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase(`teams/${teamId}`);
        const team = snap as any;
        const joinRequests = team?.joinRequests ? Object.values(team.joinRequests) as JoinRequest[] : [];
        // Simulate a request from current user (best-effort)
        const newReq: JoinRequest = { id: `req_${Date.now()}`, userId: 'current_user', timestamp: new Date().toISOString() } as JoinRequest;
        joinRequests.push(newReq);
        await writeToFirebaseData(`teams/${teamId}/joinRequests`, joinRequests).catch(e => console.warn('requestToJoinTeam firebase failed', e));
        return;
    }
    return apiFetch<void>('/teams/join_requests.php', { method: 'POST', body: JSON.stringify({ teamId }) });
};
export const manageJoinRequest = async (teamId: string, userId: string, action: 'accepted' | 'rejected'): Promise<void> => {
    if (API_BASE === '/mock') return mockApi.manageJoinRequest(teamId, userId, action);
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase(`teams/${teamId}`);
        const team = snap as any || {};
        const joinRequests = team.joinRequests ? Object.values(team.joinRequests) as JoinRequest[] : [];
        const filtered = joinRequests.filter(r => r.userId !== userId);
        await writeToFirebaseData(`teams/${teamId}/joinRequests`, filtered).catch(e => console.warn('manageJoinRequest firebase failed', e));
        if (action === 'accepted') {
            // add user's teamId in users node
            const usersSnap = await getOnceFromFirebase('users');
            const users = usersSnap || {};
            for (const k of Object.keys(users)) {
                if ((users as any)[k].id === userId) {
                    (users as any)[k].teamId = teamId;
                    break;
                }
            }
            await writeToFirebaseData('users', users).catch(e => console.warn('manageJoinRequest write users failed', e));
        }
        return;
    }
    return apiFetch<void>(`/teams/join_requests.php`, { method: 'PUT', body: JSON.stringify({ teamId, userId, status: action }) });
};
export const removeUserFromTeam = async (userId: string): Promise<void> => {
    if (API_BASE === '/mock') return mockApi.removeUserFromTeam(userId);
    if (API_BASE === 'firebase') {
        const usersSnap = await getOnceFromFirebase('users');
        const users = usersSnap || {};
        for (const k of Object.keys(users)) {
            if ((users as any)[k].id === userId) {
                (users as any)[k].teamId = undefined;
                break;
            }
        }
        await writeToFirebaseData('users', users).catch(e => console.warn('removeUserFromTeam firebase failed', e));
        return;
    }
    return apiFetch<void>('/teams/members.php', { method: 'DELETE', body: `userId=${encodeURIComponent(userId)}`});
};
export const updateTeamRoster = async (teamId: string, eventId: string, participants: string[]): Promise<void> => {
    if (API_BASE === '/mock') return mockApi.updateTeamRoster(teamId, eventId, participants);
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase(`teams/${teamId}`);
        const team = snap as any || {};
        team.rosters = team.rosters || [];
        const idx = (team.rosters as any[]).findIndex((r: any) => r.eventId === eventId);
        if (idx > -1) team.rosters[idx].participants = participants;
        else team.rosters.push({ eventId, participants });
        await writeToFirebaseData(`teams/${teamId}`, team).catch(e => console.warn('updateTeamRoster firebase failed', e));
        return;
    }
    return apiFetch(`/teams/update.php?id=${teamId}`, { method: 'PUT', body: JSON.stringify({ rosters: [{ eventId, participants }] }) });
};
export const getTeamUsers = async (teamId: string): Promise<User[]> => {
    if (API_BASE === '/mock') return mockApi.getTeamUsers(teamId);
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('users');
        const usersObj = snap || {};
        return Object.values(usersObj).filter((u: any) => u.teamId === teamId) as User[];
    }
    return apiFetch<User[]>(`/teams/members.php?teamId=${teamId}`);
};
export const getReports = (): Promise<Report[]> => API_BASE === '/mock' ? mockApi.getReports() : apiFetch<Report[]>('/reports/index.php');
export const submitReport = (reportData: any): Promise<void> => API_BASE === '/mock' ? mockApi.submitReport(reportData) : apiFetch<void>('/reports/index.php', { method: 'POST', body: JSON.stringify(reportData) });
export const updateReportStatus = (reportId: string, status: Report['status']): Promise<void> => API_BASE === '/mock' ? mockApi.updateReportStatus(reportId, status) : apiFetch<void>(`/reports/status_update.php?id=${reportId}`, { method: 'PUT', body: JSON.stringify({ status }) });
export const addReportReply = (reportId: string, reply: { reply: string }): Promise<void> => API_BASE === '/mock' ? mockApi.addReportReply(reportId, reply) : apiFetch<void>(`/reports/reply.php?id=${reportId}`, { method: 'POST', body: JSON.stringify(reply) });
export const getVisibilitySettings = async (): Promise<VisibilitySettings> => {
    if (API_BASE === '/mock') return mockApi.getVisibilitySettings();
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('visibility');
        return (snap as VisibilitySettings) || (await mockApi.getVisibilitySettings());
    }
    return apiFetch<VisibilitySettings>('/system/settings.php');
};
export const updateVisibilitySettings = async (settings: VisibilitySettings): Promise<void> => {
    if (API_BASE === '/mock') return mockApi.updateVisibilitySettings(settings);
    if (API_BASE === 'firebase') return writeToFirebaseData('visibility', settings);
    return apiFetch<void>('/system/settings.php', { method: 'PUT', body: JSON.stringify(settings) });
};
export const pingServer = async (): Promise<boolean> => {
    if (API_BASE === '/mock' || API_BASE === 'firebase') return Promise.resolve(true);
    try {
        await apiFetch<void>('/system/ping.php');
        return true;
    } catch (e) {
        return false;
    }
};
export const getRules = async (): Promise<RulesData> => {
    if (API_BASE === '/mock') return mockApi.getRules();
    if (API_BASE === 'firebase') {
        const snap = await getOnceFromFirebase('rules');
        return (snap as RulesData) || (await mockApi.getRules());
    }
    return apiFetch<RulesData>('/system/rules.php');
};
export const updateRules = async (rulesData: RulesData): Promise<void> => {
    if (API_BASE === '/mock') return mockApi.updateRules(rulesData);
    if (API_BASE === 'firebase') return writeToFirebaseData('rules', rulesData);
    return apiFetch<void>('/system/rules.php', { method: 'PUT', body: JSON.stringify(rulesData) });
};
export { STORAGE_KEYS, UserRole, subscribeToFirebaseData, writeToFirebaseData, firebaseListeners };

// Track last-received timestamps per firebase path
const lastReceivedTimestamps: { [path: string]: string } = {};
export const getLastFirebaseTimestamps = () => ({ ...lastReceivedTimestamps });
