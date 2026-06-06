export const PROJECT_PANE_MIN_WIDTH = 20;
export const PROJECT_PANE_MAX_WIDTH = 32;
export const PROJECT_PANE_RATIO = 0.28;
export const SESSION_PANE_MIN_WIDTH = 48;
export const DEFAULT_TERMINAL_WIDTH = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateProjectPaneWidth(terminalColumns?: number): number {
  const columns = terminalColumns && terminalColumns > 0
    ? terminalColumns
    : DEFAULT_TERMINAL_WIDTH;

  const preferred = Math.floor(columns * PROJECT_PANE_RATIO);
  const maxAllowedBySessionPane = Math.max(
    PROJECT_PANE_MIN_WIDTH,
    columns - SESSION_PANE_MIN_WIDTH,
  );

  return clamp(
    preferred,
    PROJECT_PANE_MIN_WIDTH,
    Math.min(PROJECT_PANE_MAX_WIDTH, maxAllowedBySessionPane),
  );
}
