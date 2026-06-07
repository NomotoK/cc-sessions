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

export interface PaneWidths {
  projectPaneWidth: number;
  sessionPaneWidth: number;
}

export function calculatePaneWidths(terminalColumns?: number): PaneWidths {
  const columns = terminalColumns && terminalColumns > 0
    ? terminalColumns
    : DEFAULT_TERMINAL_WIDTH;
  const projectPaneWidth = calculateProjectPaneWidth(columns);

  return {
    projectPaneWidth,
    sessionPaneWidth: Math.max(0, columns - projectPaneWidth),
  };
}

function isCombiningCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  );
}

function isFullWidthCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

export function getDisplayWidth(text: string): number {
  let width = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || isCombiningCodePoint(codePoint)) {
      continue;
    }

    width += isFullWidthCodePoint(codePoint) ? 2 : 1;
  }

  return width;
}

export function fillToDisplayWidth(text: string, targetWidth: number): string {
  return text + ' '.repeat(Math.max(0, targetWidth - getDisplayWidth(text)));
}
