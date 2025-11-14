import { User, UserRole, Team, Event, Report, AppNotification, VisibilitySettings, EventCategory, EventStatus } from './types.ts';

export const INITIAL_MOCK_USERS: { [id: string]: User } = {
  'admin_1': {
    id: 'admin_1',
    name: 'Benlor Rivera',
    email: 'riverabenlor461@gmail.com',
    role: UserRole.ADMIN,
    avatar: 'https://i.pravatar.cc/150?u=admin_1',
    firstName: 'Benlor',
    lastName: 'Rivera',
    studentId: 'ADMIN-BEN',
    teamId: 't5',
    password: '24025944',
    lastActive: new Date().toISOString()
  }
};

export const MOCK_LEADERBOARD: Team[] = [
  { rank: 1, id: 't1', name: 'Midnight Spades', score: 0, wins: 0, losses: 0, playersCount: 0, description: '', unitLeader: '', unitSecretary: '', unitTreasurer: '', unitErrands: [], adviser: '', merits: [], demerits: [], eventScores: [], scoreHistory: [], progressHistory: [], detailedProgressHistory: [], placementStats: { first: 0, second: 0, third: 0, fourth: 0, merits: 0, demerits: 0 }, joinRequests: [] },
  { rank: 2, id: 't2', name: 'Scarlet Hearts', score: 0, wins: 0, losses: 0, playersCount: 0, description: '', unitLeader: '', adviser: '', merits: [], demerits: [], eventScores: [], scoreHistory: [], progressHistory: [], detailedProgressHistory: [], placementStats: { first: 0, second: 0, third: 0, fourth: 0, merits: 0, demerits: 0 }, joinRequests: [] },
  { rank: 3, id: 't3', name: 'Emerald Clovers', score: 0, wins: 0, losses: 0, playersCount: 0, description: '', unitLeader: '', adviser: '', merits: [], demerits: [], eventScores: [], scoreHistory: [], progressHistory: [], detailedProgressHistory: [], placementStats: { first: 0, second: 0, third: 0, fourth: 0, merits: 0, demerits: 0 }, joinRequests: [] },
  { rank: 4, id: 't4', name: 'Glacier Diamonds', score: 0, wins: 0, losses: 0, playersCount: 0, description: '', unitLeader: '', adviser: '', merits: [], demerits: [], eventScores: [], scoreHistory: [], progressHistory: [], detailedProgressHistory: [], placementStats: { first: 0, second: 0, third: 0, fourth: 0, merits: 0, demerits: 0 }, joinRequests: [] },
  { rank: 5, id: 't5', name: 'Amaranth Jokers', score: 0, wins: 0, losses: 0, playersCount: 0, description: 'Facilitating team', facilitators: [], merits: [], demerits: [], eventScores: [], scoreHistory: [], progressHistory: [], detailedProgressHistory: [], placementStats: { first: 0, second: 0, third: 0, fourth: 0, merits: 0, demerits: 0 } },
];

export const MOCK_EVENTS: Event[] = [
// FIX: Add missing 'judges' property to satisfy the Event type.
  { id: 'jf1', name: 'Joker Flag Wave 1: Chant', category: EventCategory.JOKER_FLAG, officerInCharge: 'Bhenny & Foncee', participantsInfo: 'All members', date: new Date().toISOString(), venue: 'Game Area', description: 'A rhythmic team chant.', mechanics: 'Minimum 1 minute.', criteria: [{name: 'Creativity', description: 'Uniqueness', points: 30}], status: EventStatus.UPCOMING, competitionPoints: 1000, judges: [], results: [] },
// FIX: Add missing 'judges' property to satisfy the Event type.
  { id: 'cit1', name: 'Cheer Dance', category: EventCategory.CIT_QUEST, officerInCharge: 'Yesha', participantsInfo: '10-15 performers', date: new Date(Date.now() + 86400000).toISOString(), venue: 'Gymnasium', description: 'High-energy cheer routine.', mechanics: 'Max 5 minutes.', criteria: [{name: 'Choreography', description: 'Artistry', points: 50}], status: EventStatus.UPCOMING, competitionPoints: 1500, judges: [], results: [] },
// FIX: Add missing 'judges' property to satisfy the Event type.
  { id: 'ms7', name: 'Hackathon', category: EventCategory.MINDSCAPE, officerInCharge: 'Lryn', participantsInfo: '3 representatives', date: new Date(Date.now() - 86400000).toISOString(), venue: 'Computer Lab 1', description: 'Ideate IT solutions.', mechanics: '5 minute pitch.', criteria: [{name: 'Originality', description: 'Uniqueness', points: 40}], status: EventStatus.COMPLETED, competitionPoints: 1200, judges: [], results: [] },
  { id: 'ct3', name: 'Web Design', category: EventCategory.CODING_TECH_CHALLENGES, officerInCharge: 'Lorenz and Foncee', participantsInfo: '4 representatives', date: new Date().toISOString(), venue: 'Computer Lab 1', description: 'Web design competition.', mechanics: '4 hours to complete.', criteria: [{name: 'Design', description: 'Visuals', points: 30}], status: EventStatus.UPCOMING, competitionPoints: 1200, judges: [], results: [] },
];

export const MOCK_REPORTS: Report[] = [
    { id: 'rep1', type: 'report', problemType: 'unsportsmanlike', description: 'Player from Scarlet Hearts was being disrespectful after the match.', submittedBy: '4', timestamp: new Date(Date.now() - 3600000).toISOString(), status: 'pending', offenderName: 'A. Player', offenderTeam: 'Scarlet Hearts' },
    { id: 'rep2', type: 'suggestion', description: 'It would be great to have more water stations available near the outdoor courts.', submittedBy: '3', timestamp: new Date(Date.now() - 86400000).toISOString(), status: 'reviewed', replies: [{id: 'reply1', repliedBy: '1', message: 'Thank you for the suggestion! We are looking into this.', timestamp: new Date().toISOString()}] },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
    { id: 'notif1', title: 'Scores Updated!', message: 'Results for "Hackathon" are in! Check the leaderboard.', link: '/leaderboard', timestamp: new Date().toISOString(), type: 'success' },
    { id: 'notif2', title: 'New Event Added', message: 'A new event "Web Design" has been added to the Cipher Matrix category.', link: '/events', timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'info' },
    { id: 'notif3', title: 'Report Status Changed', message: 'Your suggestion about water stations has been reviewed.', link: '/reports', timestamp: new Date(Date.now() - 7200000).toISOString(), type: 'info', target: { userId: '3' } },
];

export const MOCK_VISIBILITY_SETTINGS: VisibilitySettings = {
  competitionScores: true,
  pages: { dashboard: true, leaderboard: true, teams: true, events: true, rules: true, reports: true, profile: true },
  dashboard: { summaryCards: true, leaderboardRanking: true, topTeams: true, teamScoreProgression: true },
  leaderboard: { tabs: { standings: true, records: true, meritsLog: true } },
  teams: { facilitatingTeam: true, participatingTeams: true, tabs: { overview: true, leadership: true, joinRequests: true, roster: true, prospects: true, progress: true, merits: true, scores: true } },
  events: { categories: { [EventCategory.JOKER_FLAG]: true, [EventCategory.CIT_QUEST]: true, [EventCategory.MINDSCAPE]: true, [EventCategory.HOOP_SPIKE]: true, [EventCategory.CODING_TECH_CHALLENGES]: true, [EventCategory.PIXEL_PLAY]: true, [EventCategory.TABLE_MASTERS]: true } },
  rules: { sections: { objectives: true, house_rules: true, demerit_system: true, complaints: true, scoring_system: true, categories_mechanics: true } },
  reports: { tabs: { view: true, submit: true } },
};