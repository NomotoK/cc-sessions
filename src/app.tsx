import React, { useEffect, useReducer, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import type { AppState, AppAction, ConfirmAction, Project, Session } from './core/types.js';
import ProjectList from './components/ProjectList.js';
import SessionList from './components/SessionList.js';
import SearchBar from './components/SearchBar.js';
import StatusBar from './components/StatusBar.js';
import ConfirmDialog from './components/ConfirmDialog.js';
import { ClaudeProjectScanner } from './core/scanner.js';
import { JsonlSessionParser } from './core/parser.js';
import { SessionDeleter } from './core/deleter.js';
import { calculateProjectPaneWidth } from './utils/layout.js';
import { PathEncoder } from './utils/path.js';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AppProps {
  projectPath?: string;
  onSelectSession?: (uuid: string, projectPath: string) => void;
}

// ---------------------------------------------------------------------------
// Reducer (pure, uses only AppState fields)
// ---------------------------------------------------------------------------

const initialState: AppState = {
  projects: [],
  sessions: [],
  selectedProjectIndex: 0,
  selectedSessionIndex: 0,
  focusedPane: 'project',
  searchQuery: '',
  searchActive: false,
  confirmDialog: null,
  loading: true,
  error: null,
  deletingIndex: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return {
        ...state,
        projects: action.projects,
        selectedProjectIndex: 0,
        loading: false,
        error: null,
      };

    case 'SET_SESSIONS':
      return {
        ...state,
        sessions: action.sessions,
        selectedSessionIndex: 0,
        searchQuery: '',
        searchActive: false,
      };

    case 'SELECT_PROJECT': {
      const project = state.projects[action.index];
      if (!project) return state;
      // Sessions must be loaded via SET_SESSIONS before or alongside this action.
      // The caller (useInput / useEffect) is responsible for looking up the sessions map.
      return {
        ...state,
        selectedProjectIndex: action.index,
        selectedSessionIndex: 0,
        searchQuery: '',
        searchActive: false,
      };
    }

    case 'SELECT_SESSION':
      return {
        ...state,
        selectedSessionIndex: action.index,
      };

    case 'TOGGLE_PANE': {
      if (state.sessions.length === 0 && state.focusedPane === 'project') {
        return state;
      }
      return {
        ...state,
        focusedPane: state.focusedPane === 'project' ? 'session' : 'project',
      };
    }

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };

    case 'SET_SEARCH_ACTIVE':
      return { ...state, searchActive: action.active };

    case 'SHOW_CONFIRM':
      return { ...state, confirmDialog: action.action };

    case 'HIDE_CONFIRM':
      return { ...state, confirmDialog: null, deletingIndex: null };

    case 'SET_LOADING':
      return { ...state, loading: action.loading };

    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };

    case 'SET_DELETING_INDEX':
      return { ...state, deletingIndex: action.index };

    case 'DELETE_SESSIONS': {
      const uuidsToDelete = new Set(action.uuids);
      const remaining = state.sessions.filter((s) => !uuidsToDelete.has(s.uuid));
      const newIndex = Math.min(
        state.selectedSessionIndex,
        Math.max(0, remaining.length - 1),
      );

      const updatedProjects = state.projects
        .map((p) => {
          const deletedCount = state.sessions.filter(
            (s) => uuidsToDelete.has(s.uuid) && s.project.encodedPath === p.encodedPath,
          ).length;
          if (deletedCount === 0) return p;
          return { ...p, sessionCount: p.sessionCount - deletedCount };
        })
        .filter((p) => p.sessionCount > 0);

      return {
        ...state,
        sessions: remaining,
        selectedSessionIndex: newIndex,
        confirmDialog: null,
        deletingIndex: null,
        projects: updatedProjects,
      };
    }

    case 'DELETE_PROJECT_SESSIONS': {
      const remainingProjects = state.projects.filter(
        (p) => p.encodedPath !== action.projectEncodedPath,
      );
      const newIndex = Math.min(
        state.selectedProjectIndex,
        Math.max(0, remainingProjects.length - 1),
      );

      return {
        ...state,
        projects: remainingProjects,
        selectedProjectIndex: newIndex,
        selectedSessionIndex: 0,
        confirmDialog: null,
        deletingIndex: null,
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// App Component
// ---------------------------------------------------------------------------

export function App({ projectPath, onSelectSession }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Sessions map stored in a ref — not part of AppState to keep types clean.
  // The caller (useInput handlers, useEffect) consults this ref when switching
  // projects and dispatches SET_SESSIONS alongside SELECT_PROJECT.
  const sessionsMapRef = useRef<Map<string, Session[]>>(new Map());

  // ----- Load projects on mount -----
  useEffect(() => {
    const projectsDir = join(homedir(), '.claude', 'projects');
    const parser = new JsonlSessionParser();
    const scanner = new ClaudeProjectScanner(projectsDir, parser);

    scanner
      .scan({ projectPath })
      .then((projectsWithSessions) => {
        const projects: Project[] = [];
        const map = new Map<string, Session[]>();
        let firstSessions: Session[] = [];

        for (const pws of projectsWithSessions) {
          const project: Project = {
            name: pws.name,
            encodedPath: pws.encodedPath,
            fullPath: pws.fullPath,
            sessionCount: pws.sessionCount,
            totalSize: pws.totalSize,
          };
          projects.push(project);
          map.set(pws.encodedPath, pws.sessions);

          if (firstSessions.length === 0) {
            firstSessions = pws.sessions;
          }
        }

        sessionsMapRef.current = map;
        dispatch({ type: 'SET_SESSIONS', sessions: firstSessions });
        dispatch({ type: 'SET_PROJECTS', projects });
      })
      .catch((err: unknown) => {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [projectPath]);

  // ----- Helper: switch to a project by index -----
  const selectProject = useCallback(
    (index: number) => {
      const project = state.projects[index];
      if (!project) return;
      const sessions = sessionsMapRef.current.get(project.encodedPath) ?? [];
      dispatch({ type: 'SET_SESSIONS', sessions });
      dispatch({ type: 'SELECT_PROJECT', index });
    },
    [state.projects],
  );

  // ----- Delete confirmation handler -----
  const handleDeleteConfirm = useCallback(
    async (confirmAction: ConfirmAction) => {
      const deleter = new SessionDeleter();
      const results = await deleter.deleteSessions(confirmAction.targets);
      const deleted = results.filter((r) => r.status === 'deleted');

      if (confirmAction.type === 'delete-project' && confirmAction.project) {
        const encodedPath = confirmAction.project.encodedPath;
        // Remove from sessionsMap
        sessionsMapRef.current.delete(encodedPath);
        dispatch({
          type: 'DELETE_PROJECT_SESSIONS',
          projectEncodedPath: encodedPath,
        });
        // Load sessions for the now-selected project
        const newState = { ...state };
        // After DELETE_PROJECT_SESSIONS, find the new selected project
        const remaining = newState.projects.filter(
          (p) => p.encodedPath !== encodedPath,
        );
        const newIndex = Math.min(
          state.selectedProjectIndex,
          Math.max(0, remaining.length - 1),
        );
        const newProject = remaining[newIndex];
        if (newProject) {
          const sessions = sessionsMapRef.current.get(newProject.encodedPath) ?? [];
          dispatch({ type: 'SET_SESSIONS', sessions });
        }
      } else {
        // Delete individual sessions — update sessionsMap too
        const uuidsToDelete = new Set(deleted.map((r) => r.uuid));
        const currentProject = state.projects[state.selectedProjectIndex];
        if (currentProject) {
          const currentSessions =
            sessionsMapRef.current.get(currentProject.encodedPath) ?? [];
          const updated = currentSessions.filter((s) => !uuidsToDelete.has(s.uuid));
          sessionsMapRef.current.set(currentProject.encodedPath, updated);
        }
        dispatch({ type: 'DELETE_SESSIONS', uuids: deleted.map((r) => r.uuid) });
      }
    },
    [state],
  );

  // ----- Filtered sessions -----
  const filteredSessions = state.searchQuery
    ? state.sessions.filter((s) =>
        s.label.toLowerCase().includes(state.searchQuery.toLowerCase()),
      )
    : state.sessions;

  // ----- Derived values -----
  const currentProject = state.projects[state.selectedProjectIndex];

  // ----- Keyboard handling -----
  useInput((input, key) => {
    // Priority 1: Confirm dialog is open
    if (state.confirmDialog) {
      if (input === 'y' || input === 'Y') {
        handleDeleteConfirm(state.confirmDialog);
      } else if (input === 'n' || input === 'N' || key.escape) {
        dispatch({ type: 'HIDE_CONFIRM' });
      }
      return;
    }

    // Priority 2: Search active
    if (state.searchActive) {
      if (key.escape) {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
        dispatch({ type: 'SET_SEARCH', query: '' });
      }
      return;
    }

    // Priority 3: Normal mode
    if (input === 'q') {
      exit();
      return;
    }

    // Up / k
    if (key.upArrow || input === 'k') {
      if (state.focusedPane === 'project') {
        const next = Math.max(0, state.selectedProjectIndex - 1);
        if (next !== state.selectedProjectIndex) {
          selectProject(next);
        }
      } else {
        const next = Math.max(0, state.selectedSessionIndex - 1);
        dispatch({ type: 'SELECT_SESSION', index: next });
      }
      return;
    }

    // Down / j
    if (key.downArrow || input === 'j') {
      if (state.focusedPane === 'project') {
        const max = state.projects.length - 1;
        const next = Math.min(max, state.selectedProjectIndex + 1);
        if (next !== state.selectedProjectIndex) {
          selectProject(next);
        }
      } else {
        const max = filteredSessions.length - 1;
        const next = Math.min(max, state.selectedSessionIndex + 1);
        dispatch({ type: 'SELECT_SESSION', index: next });
      }
      return;
    }

    // Tab - toggle pane
    if (key.tab) {
      dispatch({ type: 'TOGGLE_PANE' });
      return;
    }

    // Left arrow - switch to project pane
    if (key.leftArrow) {
      if (state.focusedPane !== 'project') {
        dispatch({ type: 'TOGGLE_PANE' });
      }
      return;
    }

    // Right arrow - switch to session pane
    if (key.rightArrow) {
      if (state.focusedPane !== 'session' && filteredSessions.length > 0) {
        dispatch({ type: 'TOGGLE_PANE' });
      }
      return;
    }

    // Session pane shortcuts
    if (state.focusedPane === 'session') {
      const currentSession = filteredSessions[state.selectedSessionIndex];

      // Enter - select session and exit
      if (key.return && currentSession) {
        onSelectSession?.(currentSession.uuid, PathEncoder.decode(currentSession.project.encodedPath));
        exit();
        return;
      }

      // Ctrl+D - delete current session
      if (key.ctrl && input === 'd') {
        if (currentSession) {
          dispatch({ type: 'SET_DELETING_INDEX', index: state.selectedSessionIndex });
          dispatch({
            type: 'SHOW_CONFIRM',
            action: { type: 'delete-sessions', targets: [currentSession] },
          });
        }
        return;
      }

      // / - activate search
      if (input === '/') {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: true });
        return;
      }

      // Esc - switch to project pane
      if (key.escape) {
        dispatch({ type: 'TOGGLE_PANE' });
        return;
      }
    }

    // Project pane shortcuts
    if (state.focusedPane === 'project') {
      // Ctrl+D - delete all project sessions
      if (key.ctrl && input === 'd') {
        if (currentProject && state.sessions.length > 0) {
          dispatch({ type: 'SET_DELETING_INDEX', index: state.selectedProjectIndex });
          dispatch({
            type: 'SHOW_CONFIRM',
            action: {
              type: 'delete-project',
              targets: state.sessions,
              project: currentProject,
            },
          });
        }
        return;
      }

      // Enter - switch to session pane
      if (key.return && state.sessions.length > 0) {
        dispatch({ type: 'TOGGLE_PANE' });
        return;
      }
    }
  });

  // ----- Terminal size calculations -----
  const terminalHeight = stdout?.rows ?? 24;
  const terminalColumns = stdout?.columns ?? 80;
  const projectPaneWidth = calculateProjectPaneWidth(terminalColumns);
  const sessionPaneWidth = Math.max(0, terminalColumns - projectPaneWidth);
  const listHeight = Math.max(3, terminalHeight - 5); // 2 header + 3 footer
  const projectListHeight = listHeight - 1;

  // ----- Loading / error states -----
  if (state.loading) {
    return <Text>Scanning sessions...</Text>;
  }

  if (state.error) {
    return <Text color="red">Error: {state.error}</Text>;
  }

  if (state.projects.length === 0) {
    return <Text>No sessions found.</Text>;
  }

  // Determine which index is pending deletion (for red highlight)
  // When in session pane, deletingIndex refers to a session; in project pane, to a project.
  const sessionDeletingIndex = state.focusedPane === 'session' ? state.deletingIndex : null;
  const projectDeletingIndex = state.focusedPane === 'project' ? state.deletingIndex : null;

  // ----- Render -----
  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Box flexDirection="row" flexGrow={1}>
        <ProjectList
          projects={state.projects}
          selectedIndex={state.selectedProjectIndex}
          isFocused={state.focusedPane === 'project'}
          visibleHeight={projectListHeight}
          deletingIndex={projectDeletingIndex}
          width={projectPaneWidth}
        />
        <Box flexDirection="column" flexGrow={1}>
          <SearchBar
            active={state.searchActive}
            query={state.searchQuery}
            onQueryChange={(q: string) => dispatch({ type: 'SET_SEARCH', query: q })}
            onSubmit={() => {
              // Search stays active; user browses filtered results
            }}
            onCancel={() => {
              dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
              dispatch({ type: 'SET_SEARCH', query: '' });
            }}
            projectName={currentProject?.name ?? ''}
            width={sessionPaneWidth}
          />
          <SessionList
            sessions={filteredSessions}
            selectedIndex={state.selectedSessionIndex}
            isFocused={state.focusedPane === 'session'}
            visibleHeight={projectListHeight}
            deletingIndex={sessionDeletingIndex}
            width={sessionPaneWidth}
          />
        </Box>
      </Box>
      <StatusBar
        focusedPane={state.focusedPane}
        searchActive={state.searchActive}
        confirmVisible={state.confirmDialog !== null}
      />
      {state.confirmDialog && <ConfirmDialog action={state.confirmDialog} />}
    </Box>
  );
}
