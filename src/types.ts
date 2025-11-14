

export enum UserRole {
  USER = 'user',
  TEAM_LEAD = 'team_lead',
  OFFICER = 'officer',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  name: string; // Kept for backward compatibility, derived from first+last
  email: string;
  role: UserRole;
  avatar: string;
  studentId?: string;
  bio?: string;
  teamId?: string;
  password?: string; // For mock auth only
  
  // New profile fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  contactInfo?: string;
  yearLevel?: string;
  section?: string;
  interestedEvents?: string[]; // Array of event names/ids
  gender?: string;
  birthdate?: string;
  lastActive?: string;
}

// New types for team details
export interface PointLog {
    id?: string;
    points: number;
    reason: string;
    updatedBy: string; // Name of officer/admin
    timestamp: string;
}

export interface Demerit extends PointLog {
    responsiblePerson?: string; // Name of the person who got the demerit
}

export interface Merit extends PointLog {}

export interface JudgeScore {
    criteria: string;
    score: number;
    maxScore: number;
}

// Updated to include detailed breakdown lists
export interface EventScore {
    eventId: string;
    eventName: string;
    placement: number;
    competitionPoints: number;
    rawScore: number; // Sum of criteria scores
    scores: JudgeScore[];
    meritAdjustment?: number;
    demeritAdjustment?: number;
    merits?: ScoreAdjustment[];
    demerits?: ScoreAdjustment[];
}

export interface PlacementStats {
  first: number;
  second: number;
  third: number;
  fourth: number;
  merits: number;
  demerits: number;
}

export interface ScoreHistoryPoint {
    date: string;
    score: number;
}

export interface DetailedScoreHistoryPoint {
    timestamp: string;
    score: number;
    reason: string;
    change: number;
}

export interface FacilitatorPermission {
    canDelete: boolean;
    canUpdate: boolean;
    canAdd: boolean;
    canPassScores: boolean;
}

export interface Facilitator {
    userId: string;
    position: string;
    roleDescription: string;
    permissions: FacilitatorPermission;
}

export interface Roster {
    eventId: string;
    participants: string[]; // Roster of participant names
}

export interface JoinRequest {
  id: string;
  userId: string;
  timestamp: string;
  // User details to be joined from the users table
  first_name?: string;
  last_name?: string;
}

export interface Team {
  rank: number;
  id: string;
  name: string;
  score: number;
  wins: number;
  losses: number;
  playersCount: number;
  description?: string;
  merits?: Merit[];
  demerits?: Demerit[];
  eventScores?: EventScore[];
  scoreHistory?: number[]; // Old history format
  progressHistory?: ScoreHistoryPoint[]; // New history format for graphs
  detailedProgressHistory?: DetailedScoreHistoryPoint[];
  
  // Leadership roles now store User IDs
  unitLeader?: string; // User ID
  unitSecretary?: string; // User ID
  unitTreasurer?: string; // User ID
  unitErrands?: string[]; // Array of User IDs
  adviser?: string; // User ID
  placementStats?: PlacementStats;
  facilitators?: Facilitator[];
  rosters?: Roster[];
  joinRequests?: JoinRequest[];
}

export enum EventStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  UPCOMING = 'upcoming',
  COMPLETED = 'completed'
}

export enum EventCategory {
  JOKER_FLAG = 'Joker Flag',
  CIT_QUEST = 'CIT Quest',
  MINDSCAPE = 'MindScape',
  HOOP_SPIKE = 'Hoop & Spike',
  CODING_TECH_CHALLENGES = 'Cipher Matrix',
  PIXEL_PLAY = 'Pixel Play',
  TABLE_MASTERS = 'Table Masters'
}

export interface CriteriaItem {
  name: string;
  description: string;
  points: number;
}

// New interface for specific score adjustments
export interface ScoreAdjustment {
    name: string;
    description?: string;
    points: number;
    timestamp?: string;
    venue?: string;
}

export interface EventResult {
    teamId: string;
    criteriaScores: Record<string, number>; // Map criteria name -> score
    meritAdjustment: number;
    demeritAdjustment: number;
    merits?: ScoreAdjustment[]; // Detailed merit entries
    demerits?: ScoreAdjustment[]; // Detailed demerit entries
}

export interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  description: string;
  mechanics: string;
  criteria: CriteriaItem[];
  status: EventStatus;
  category: EventCategory;
  officerInCharge: string;
  participantsInfo: string;
  judges: string[];
  competitionPoints: number;
  results?: EventResult[]; // Stores raw inputs for each team
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  link: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read?: boolean;
  target?: {
    roles?: UserRole[];
    teamId?: string;
    userId?: string;
  };
}

export interface Activity {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  target?: {
    type: 'user' | 'team' | 'event';
    name: string;
    link: string;
  };
}

export interface ReportReply {
  id: string;
  repliedBy: string; // User ID
  message: string;
  timestamp: string;
}

export interface Report {
  id: string;
  type: 'report' | 'suggestion';
  problemType?: string;
  description: string;
  offenderName?: string;
  offenderTeam?: string;
  evidence?: string;
  submittedBy: string; // User ID
  timestamp: string;
  status: 'pending' | 'reviewed' | 'resolved';
  replies?: ReportReply[];
}

export interface VisibilitySettings {
  // Optional metadata for conflict/version handling
  version?: number;
  updatedAt?: string;
  competitionScores: boolean;

  pages: {
    dashboard: boolean;
    leaderboard: boolean;
    teams: boolean;
    events: boolean;
    rules: boolean;
    reports: boolean;
    profile: boolean;
  };

  dashboard: {
    summaryCards: boolean;
    leaderboardRanking: boolean;
    topTeams: boolean;
    teamScoreProgression: boolean;
  };

  leaderboard: {
    tabs: {
      standings: boolean;
      records: boolean;
      meritsLog: boolean;
    };
  };

  teams: {
    facilitatingTeam: boolean;
    participatingTeams: boolean;
    tabs: {
      overview: boolean;
      leadership: boolean;
      joinRequests: boolean;
      roster: boolean;
      prospects: boolean;
      progress: boolean;
      merits: boolean;
      scores: boolean;
    };
  };

  events: {
    categories: {
      [key in EventCategory]: boolean;
    };
  };

  rules: {
    sections: {
      [key: string]: boolean; // 'objectives', 'house_rules', etc.
    };
  };

  reports: {
    tabs: {
      view: boolean;
      submit: boolean;
    };
  };
}


export interface RuleTable {
    type: 'table';
    headers: string[];
    rows: (string | number)[][];
}

export interface RuleList {
    type: 'list';
    items: (string | RuleList)[]; // Items can be strings or nested lists
}

export interface RuleParagraph {
    type: 'paragraph';
    content: string;
}

export interface RuleHeading {
    type: 'heading';
    level: 2 | 3; // h2 or h3
    content: string;
}

export type RuleItem = RuleTable | RuleList | RuleParagraph | RuleHeading;

export interface RuleSection {
    id: string;
    title: string;
    items: RuleItem[];
}

export interface RulesData {
    mainTitle: string;
    subTitle: string;
    hashTags: string;
    sections: RuleSection[];
}