/** Encoded path under ~/.claude/projects/ (e.g., "-Users-hailin-Code-accounting-agent") */
export interface Project {
  name: string;
  encodedPath: string;
  fullPath: string;
  sessionCount: number;
  totalSize: number;
}

export type LabelSource = 'custom-title' | 'ai-title' | 'last-prompt' | 'first-message' | 'fallback';

export interface Session {
  uuid: string;
  project: Project;
  label: string;
  labelSource: LabelSource;
  modifiedAt: Date;
  size: number;
  isActive: boolean;
  artifactDirExists: boolean;
}

/** Raw metadata extracted from JSONL before label resolution */
export interface SessionMetadata {
  customTitle: string | null;
  aiTitle: string | null;
  lastPrompt: string | null;
  firstUserMessage: string | null;
}

export interface ConfirmAction {
  type: 'delete-sessions' | 'delete-project';
  targets: Session[];
  project?: Project;
}

export type FocusedPane = 'project' | 'session';

export interface AppState {
  projects: Project[];
  sessions: Session[];
  selectedProjectIndex: number;
  selectedSessionIndex: number;
  markedSessions: Set<string>;
  focusedPane: FocusedPane;
  searchQuery: string;
  searchActive: boolean;
  confirmDialog: ConfirmAction | null;
  loading: boolean;
  error: string | null;
}

export type AppAction =
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'SET_SESSIONS'; sessions: Session[] }
  | { type: 'SELECT_PROJECT'; index: number }
  | { type: 'SELECT_SESSION'; index: number }
  | { type: 'TOGGLE_MARK'; uuid: string }
  | { type: 'CLEAR_MARKS' }
  | { type: 'TOGGLE_PANE' }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_SEARCH_ACTIVE'; active: boolean }
  | { type: 'SHOW_CONFIRM'; action: ConfirmAction }
  | { type: 'HIDE_CONFIRM' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'DELETE_SESSIONS'; uuids: string[] }
  | { type: 'DELETE_PROJECT_SESSIONS'; projectEncodedPath: string };
