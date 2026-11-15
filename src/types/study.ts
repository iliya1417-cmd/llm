export type ActivityTypeValue = 'read' | 'class' | 'video' | 'solo' | 'exam' | 'review';
export type ActivityKind = 'learn' | 'practice';
export type TestKind = 'video' | 'solo' | 'exam';
export type TabId = 'daily' | 'weekly' | 'analysis' | 'syllabus' | 'history';
export type NormStatus = 'low' | 'ok' | 'high' | 'none';

export interface StudySession {
  id?: string;
  subject: string;
  topic: string;
  start: string;
  end: string;
  minutes: number;
  duration?: number;
  tests: number;
  testType: ActivityTypeValue | 'film' | 'practice' | string;
}

export interface DayEntry {
  sleep: number;
  phone: number;
  rest: number;
  film?: number;
  sessions: StudySession[];
}

export type WeekData = Record<string, DayEntry>;
export type AllWeeks = Record<string, WeekData>;

export interface SubTopic {
  id: string;
  t: string;
  f: boolean;
  p: boolean;
  x?: boolean;
}

export interface Chapter {
  id: string;
  g: string;
  t: string;
  read: string | null;
  test: boolean;
  stage: number;
  due: string | null;
  nr?: boolean;
  x?: boolean;
  subs?: SubTopic[];
}

export interface ReviewLogEntry {
  d: string;
  s: string;
  t: string;
  id?: string;
  type?: 'done' | 'skip' | 'del';
  prevStage: number;
  prevDue: string | null;
}

export interface SyllabusData {
  subjects: Record<string, Chapter[]>;
  log: ReviewLogEntry[];
  revOrder?: string[];
  v2?: boolean;
}

export interface TableConfigItem {
  order: string[];
  hidden: string[];
}

export interface WeeklyTableSettings {
  days?: TableConfigItem;
  cols?: TableConfigItem;
  rows?: TableConfigItem;
  hideSec?: string[];
}

export interface AnalysisSettings {
  order?: string[];
  hide?: string[];
}

export interface AppSettings {
  exam: [number, number, number];
  gaps?: number[];
  wk?: WeeklyTableSettings;
  an?: AnalysisSettings;
}

export interface DayStats {
  sess: number;
  sessFilm: number;
  cardFilm: number;
  practice: number;
  tests: number;
  sleep: number;
  phone: number;
  rest: number;
}

export interface SubjectStats {
  minutes: number;
  film: number;
  practice: number;
  tests: number;
  solo: number;
  video: number;
  exam: number;
}

export interface WeekStats {
  studyMin: number;
  sessFilm: number;
  cardFilm: number;
  filmMin: number;
  totalMin: number;
  videoMin: number;
  practiceMin: number;
  tests: number;
  solo: number;
  video: number;
  exam: number;
  phone: number;
  sleep: number;
  sleepDays: number;
  rest: number;
  studyDays: number;
  specialMin: number;
  generalMin: number;
  topSubject: string;
  days: Record<string, DayStats>;
  subjects: Record<string, SubjectStats>;
}

export interface WeekMetrics {
  st: WeekStats;
  logged: number;
  ed: number;
  totalH: number;
  dayAvg: number;
  wakeShare: number | null;
  avgSleep: number | null;
  practiceShare: number | null;
  generalShare: number | null;
  phoneAvg: number | null;
}

export interface BackupEnvelope {
  app: 'study-dashboard';
  version: number;
  exportedAt: string;
  integrity?: {
    algorithm: 'SHA-256';
    hash: string;
  };
  encrypted?: boolean;
  cipher?: {
    alg: 'AES-GCM';
    salt: string;
    iv: string;
    iterations: number;
    ciphertext: string;
  };
  weeks?: AllWeeks;
  syllabus?: SyllabusData;
  settings?: AppSettings;
}
