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
            if (log.type === 'merit') {
                team.merits = [...(team.merits || []), logEntry];
                team.score += log.points;
            } else {
                team.demerits = [...(team.demerits || []), logEntry];
                team.score -= log.points;
            }
            setStoredData(STORAGE_KEYS.TEAMS, teamsStore);
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
    if (API_BASE === '/mock') {
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
    if (API_BASE === '/mock') return mockApi.loginWithGoogle(googleData);
    const { user, token, isNew } = await apiFetch<{ token: string, user: User, isNew: boolean }>('/auth/google.php', { method: 'POST', body: JSON.stringify(googleData) });
    if (token) localStorage.setItem('token', token);
    return { user, isNew };
};
export const completeUserProfile = async (userData: User): Promise<User> => {
    if (API_BASE === '/mock') return (await mockApi.completeUserProfile(userData)).user;
    return (await apiFetch<{user: User}>('/auth/complete-profile.php', { method: 'PUT', body: JSON.stringify(userData) })).user;
};
export const register = async (userData: Partial<User>): Promise<User> => {
    if (API_BASE === '/mock') return (await mockApi.register(userData)).user;
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
    if (API_BASE === '/mock') {
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
export const getUsers = (): Promise<User[]> => 
  API_BASE === '/mock' ? mockApi.getUsers() : withMockFallback(
    () => apiFetch<User[]>('/users/get.php'),
    () => mockApi.getUsers()
  );
export const updateUserRole = (userId: string, role: UserRole): Promise<User> => API_BASE === '/mock' ? mockApi.updateUserRole(userId, role) : apiFetch<User>(`/users/update.php?id=${userId}`, { method: 'PUT', body: JSON.stringify({ role }) });
export const getLeaderboard = (): Promise<Team[]> => 
  API_BASE === '/mock' ? mockApi.getLeaderboard() : withMockFallback(
    () => apiFetch<Team[]>('/teams/get.php'),
    () => mockApi.getLeaderboard()
  );
export const updateTeam = (teamData: Partial<Team>): Promise<Team> => API_BASE === '/mock' ? mockApi.updateTeam(teamData) : apiFetch<Team>(`/teams/update.php?id=${teamData.id}`, { method: 'PUT', body: JSON.stringify(teamData) });
export const getEvents = (): Promise<Event[]> => 
  API_BASE === '/mock' ? mockApi.getEvents() : withMockFallback(
    () => apiFetch<Event[]>('/events/get.php'),
    () => mockApi.getEvents()
  );
export const addEvent = (eventData: Partial<Event>): Promise<Event> => API_BASE === '/mock' ? mockApi.addEvent(eventData) : apiFetch<Event>('/events/create.php', { method: 'POST', body: JSON.stringify(eventData) });
export const updateEvent = (eventData: Event): Promise<Event> => API_BASE === '/mock' ? mockApi.updateEvent(eventData) : apiFetch<Event>(`/events/update.php?id=${eventData.id}`, { method: 'PUT', body: JSON.stringify(eventData) });
export const deleteEvent = (eventId: string): Promise<void> => API_BASE === '/mock' ? mockApi.deleteEvent(eventId) : apiFetch<void>(`/events/delete.php?id=${eventId}`, { method: 'DELETE' });
export const updateEventResults = (eventId: string, results: EventResult[]): Promise<Event> => API_BASE === '/mock' ? mockApi.updateEventResults(eventId, results) : apiFetch<Event>(`/events/results.php?id=${eventId}`, { method: 'PUT', body: JSON.stringify({ results }) });
export const getNotifications = (): Promise<AppNotification[]> => API_BASE === '/mock' ? mockApi.getNotifications() : apiFetch<AppNotification[]>('/system/notifications.php');
export const logActivity = async (userId: string, action: string, target?: Activity['target']): Promise<void> => console.log(`Activity Log (not sent): User ${userId} ${action}`, target || '');
export const addPointLog = (log: { teamId: string, type: 'merit' | 'demerit', reason: string, points: number }): Promise<void> => API_BASE === '/mock' ? mockApi.addPointLog(log) : apiFetch<void>('/points/index.php', { method: 'POST', body: JSON.stringify(log) });
export const deletePointLog = (logId: string): Promise<void> => API_BASE === '/mock' ? mockApi.deletePointLog(logId) : apiFetch<void>(`/points/delete.php?id=${logId}`, { method: 'DELETE' });
export const updatePointLog = (logId: string, updatedLog: Partial<PointLog> & { teamId: string }): Promise<void> => API_BASE === '/mock' ? mockApi.updatePointLog(logId, updatedLog) : apiFetch<void>(`/points/update.php?id=${logId}`, { method: 'PUT', body: JSON.stringify({ team_id: updatedLog.teamId, reason: updatedLog.reason, points: updatedLog.points }) });
export const getJoinRequests = (teamId: string): Promise<JoinRequest[]> => apiFetch<JoinRequest[]>(`/teams/join_requests.php?teamId=${teamId}`);
export const requestToJoinTeam = (teamId: string): Promise<void> => API_BASE === '/mock' ? mockApi.requestToJoinTeam(teamId) : apiFetch<void>('/teams/join_requests.php', { method: 'POST', body: JSON.stringify({ teamId }) });
export const manageJoinRequest = (teamId: string, userId: string, action: 'accepted' | 'rejected'): Promise<void> => API_BASE === '/mock' ? mockApi.manageJoinRequest(teamId, userId, action) : apiFetch<void>(`/teams/join_requests.php`, { method: 'PUT', body: JSON.stringify({ teamId, userId, status: action }) });
export const removeUserFromTeam = (userId: string): Promise<void> => API_BASE === '/mock' ? mockApi.removeUserFromTeam(userId) : apiFetch<void>('/teams/members.php', { method: 'DELETE', body: `userId=${encodeURIComponent(userId)}`});
export const updateTeamRoster = (teamId: string, eventId: string, participants: string[]): Promise<void> => API_BASE === '/mock' ? mockApi.updateTeamRoster(teamId, eventId, participants) : apiFetch(`/teams/update.php?id=${teamId}`, { method: 'PUT', body: JSON.stringify({ rosters: [{ eventId, participants }] }) });
export const getTeamUsers = (teamId: string): Promise<User[]> => API_BASE === '/mock' ? mockApi.getTeamUsers(teamId) : apiFetch<User[]>(`/teams/members.php?teamId=${teamId}`);
export const getReports = (): Promise<Report[]> => API_BASE === '/mock' ? mockApi.getReports() : apiFetch<Report[]>('/reports/index.php');
export const submitReport = (reportData: any): Promise<void> => API_BASE === '/mock' ? mockApi.submitReport(reportData) : apiFetch<void>('/reports/index.php', { method: 'POST', body: JSON.stringify(reportData) });
export const updateReportStatus = (reportId: string, status: Report['status']): Promise<void> => API_BASE === '/mock' ? mockApi.updateReportStatus(reportId, status) : apiFetch<void>(`/reports/status_update.php?id=${reportId}`, { method: 'PUT', body: JSON.stringify({ status }) });
export const addReportReply = (reportId: string, reply: { reply: string }): Promise<void> => API_BASE === '/mock' ? mockApi.addReportReply(reportId, reply) : apiFetch<void>(`/reports/reply.php?id=${reportId}`, { method: 'POST', body: JSON.stringify(reply) });
export const getVisibilitySettings = (): Promise<VisibilitySettings> => API_BASE === '/mock' ? mockApi.getVisibilitySettings() : apiFetch<VisibilitySettings>('/system/settings.php');
export const updateVisibilitySettings = (settings: VisibilitySettings): Promise<void> => API_BASE === '/mock' ? mockApi.updateVisibilitySettings(settings) : apiFetch<void>('/system/settings.php', { method: 'PUT', body: JSON.stringify(settings) });
export const pingServer = async (): Promise<boolean> => {
    if (API_BASE === '/mock') return Promise.resolve(true);
    try {
        await apiFetch<void>('/system/ping.php');
        return true;
    } catch (e) {
        return false;
    }
};
export const getRules = (): Promise<RulesData> => API_BASE === '/mock' ? mockApi.getRules() : apiFetch<RulesData>('/system/rules.php');
export const updateRules = (rulesData: RulesData): Promise<void> => API_BASE === '/mock' ? mockApi.updateRules(rulesData) : apiFetch<void>('/system/rules.php', { method: 'PUT', body: JSON.stringify(rulesData) });
export { STORAGE_KEYS, UserRole };
