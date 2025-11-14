import React, { createContext, useState, useEffect } from 'react';
import { VisibilitySettings, UserRole, EventCategory } from '../types.ts';
import { getVisibilitySettings, updateVisibilitySettings } from '../services/api.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { AMARANTH_JOKERS_TEAM_ID } from '../constants.ts';

interface VisibilityContextType {
  settings: VisibilitySettings;
  setSettings: (settings: VisibilitySettings) => void;
  isPrivileged: boolean;
}

export const STORAGE_KEY_VISIBILITY = 'sims_visibility_settings';
const STORAGE_EVENT_KEY = 'storage-update';

const defaultSettings: VisibilitySettings = {
  competitionScores: true,
  pages: {
    dashboard: true,
    leaderboard: true,
    teams: true,
    events: true,
    rules: true,
    reports: true,
    profile: true,
  },
  dashboard: {
    summaryCards: true,
    leaderboardRanking: true,
    topTeams: true,
    teamScoreProgression: true,
  },
  leaderboard: {
    tabs: {
      standings: true,
      records: true,
      meritsLog: true,
    },
  },
  teams: {
    facilitatingTeam: true,
    participatingTeams: true,
    tabs: {
      overview: true,
      leadership: true,
      joinRequests: true,
      roster: true,
      prospects: true,
      progress: true,
      merits: true,
      scores: true,
    },
  },
  events: {
    categories: {
      [EventCategory.JOKER_FLAG]: true,
      [EventCategory.CIT_QUEST]: true,
      [EventCategory.MINDSCAPE]: true,
      [EventCategory.HOOP_SPIKE]: true,
      [EventCategory.CODING_TECH_CHALLENGES]: true,
      [EventCategory.PIXEL_PLAY]: true,
      [EventCategory.TABLE_MASTERS]: true,
    },
  },
  rules: {
    sections: {
      objectives: true,
      house_rules: true,
      demerit_system: true,
      complaints: true,
      scoring_system: true,
      categories_mechanics: true,
    },
  },
  reports: {
    tabs: {
      view: true,
      submit: true,
    },
  },
};

const isObject = (item: unknown): item is Record<string, unknown> => {
    return !!item && typeof item === 'object' && !Array.isArray(item);
};

// Helper for deep merge to handle migration from old settings structure
const mergeSettings = (stored: string | null): VisibilitySettings => {
    if (!stored) {
        return defaultSettings;
    }
    try {
        const parsed = JSON.parse(stored);
        if (!isObject(parsed)) {
            return defaultSettings;
        }

        const merged: VisibilitySettings = JSON.parse(JSON.stringify(defaultSettings)); // Deep clone default

        // Top level
        if (typeof parsed.competitionScores === 'boolean') {
            merged.competitionScores = parsed.competitionScores;
        }

        // Pages
        if (isObject(parsed.pages)) {
            for (const key of Object.keys(merged.pages)) {
                if (typeof (parsed.pages as any)[key] === 'boolean') {
                    (merged.pages as any)[key] = (parsed.pages as any)[key];
                }
            }
        }

        // Dashboard (with migration from old property names)
        if (isObject(parsed.dashboard)) {
             if (typeof (parsed.dashboard as any).leaderboardRankingChart === 'boolean') {
                (parsed.dashboard as any).leaderboardRanking = (parsed.dashboard as any).leaderboardRankingChart;
            }
            if (typeof (parsed.dashboard as any).teamProgressBars === 'boolean') {
                (parsed.dashboard as any).teamScoreProgression = (parsed.dashboard as any).teamProgressBars;
            }
            for (const key of Object.keys(merged.dashboard)) {
                if (typeof (parsed.dashboard as any)[key] === 'boolean') {
                    (merged.dashboard as any)[key] = (parsed.dashboard as any)[key];
                }
            }
        }
        
        // Leaderboard
        if (isObject(parsed.leaderboard) && isObject(parsed.leaderboard.tabs)) {
            for (const key of Object.keys(merged.leaderboard.tabs)) {
                if (typeof (parsed.leaderboard.tabs as any)[key] === 'boolean') {
                    (merged.leaderboard.tabs as any)[key] = (merged.leaderboard.tabs as any)[key];
                }
            }
        }
        
        // Teams
        if (isObject(parsed.teams)) {
            if (typeof (parsed.teams as any).facilitatingTeam === 'boolean') merged.teams.facilitatingTeam = (parsed.teams as any).facilitatingTeam;
            if (typeof (parsed.teams as any).participatingTeams === 'boolean') merged.teams.participatingTeams = (parsed.teams as any).participatingTeams;
            if (isObject(parsed.teams.tabs)) {
                 for (const key of Object.keys(merged.teams.tabs)) {
                    if (typeof (parsed.teams.tabs as any)[key] === 'boolean') {
                        (merged.teams.tabs as any)[key] = (parsed.teams.tabs as any)[key];
                    }
                }
            }
        }
        
        // Events
        if (isObject(parsed.events) && isObject(parsed.events.categories)) {
            for (const key of Object.keys(merged.events.categories)) {
                if (typeof (parsed.events.categories as any)[key] === 'boolean') {
                    (merged.events.categories as any)[key] = (merged.events.categories as any)[key];
                }
            }
        }
        
        // Rules
        if (isObject(parsed.rules) && isObject(parsed.rules.sections)) {
            for (const key of Object.keys(merged.rules.sections)) {
                if (typeof (parsed.rules.sections as any)[key] === 'boolean') {
                    (merged.rules.sections as any)[key] = (merged.rules.sections as any)[key];
                }
            }
        }
        
        // Reports
        if (isObject(parsed.reports) && isObject(parsed.reports.tabs)) {
            for (const key of Object.keys(merged.reports.tabs)) {
                if (typeof (parsed.reports.tabs as any)[key] === 'boolean') {
                    (merged.reports.tabs as any)[key] = (merged.reports.tabs as any)[key];
                }
            }
        }

        return merged;
    } catch (e) {
        console.error("Failed to parse settings, returning defaults", e);
        return defaultSettings;
    }
};

export const VisibilityContext = createContext<VisibilityContextType | undefined>(undefined);

export const VisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<VisibilitySettings>(() => {
      const storedSettings = localStorage.getItem(STORAGE_KEY_VISIBILITY);
      return mergeSettings(storedSettings);
  });

  // On mount, attempt to fetch settings from backend (or mock API). This ensures
  // settings persist across devices and sessions. Falls back to localStorage defaults.
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const remote = await getVisibilitySettings();
        if (!mounted) return;
        // Merge remote with defaults to handle missing keys/migrations
        const merged = mergeSettings(JSON.stringify(remote));
        setSettingsState(merged);
        // Persist locally so other tabs/devices can pick it up via storage events
        localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(merged));
      } catch (err) {
        // If fetching fails, keep local settings
        console.warn('Failed to fetch visibility settings from server, using local settings.', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const { user } = useAuth();

  const isPrivileged = user?.role === UserRole.ADMIN || user?.teamId === AMARANTH_JOKERS_TEAM_ID;

    const setSettings = (newSettings: VisibilitySettings) => {
    // Update local state & storage immediately for instant UI feedback
    localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(newSettings));
    // store a timestamp so we have a lightweight last-write indicator
    try { localStorage.setItem(`${STORAGE_KEY_VISIBILITY}_ts`, new Date().toISOString()); } catch {}
    setSettingsState(newSettings);
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT_KEY, { detail: { key: STORAGE_KEY_VISIBILITY } }));

    // Enqueue for background sync so devices that are offline will flush later.
    try {
      import('../utils/syncQueue').then(({ enqueue, processQueue }) => {
        enqueue('visibility:update', newSettings);
        // Also log activity for auditing
        enqueue('activity:log', { userId: (user && user.id) || 'unknown', action: 'updated_visibility_settings' });
        // Kickoff a background process (best-effort)
        processQueue();
      }).catch(() => {
        // If dynamic import fails, fallback to direct save
        updateVisibilitySettings(newSettings).catch(e => console.error('Failed to save visibility settings to server:', e));
      });
    } catch (err) {
      // If queue fails synchronously, fallback to direct save (best-effort)
      updateVisibilitySettings(newSettings).catch(e => console.error('Failed to save visibility settings to server:', e));
    }
  };

  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const key = (e as CustomEvent).detail?.key || (e as StorageEvent).key;
      if (key === STORAGE_KEY_VISIBILITY) {
          const storedSettings = localStorage.getItem(STORAGE_KEY_VISIBILITY);
          setSettingsState(mergeSettings(storedSettings));
      }
    };

    window.addEventListener(STORAGE_EVENT_KEY, handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener(STORAGE_EVENT_KEY, handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);


  return (
    <VisibilityContext.Provider value={{ settings, setSettings, isPrivileged }}>
      {children}
    </VisibilityContext.Provider>
  );
};