import { describe, expect, it } from 'vitest';
import {
  calculatePaneWidths,
  calculateProjectPaneWidth,
  fillToDisplayWidth,
  getDisplayWidth,
} from '../../src/utils/layout.js';

describe('calculateProjectPaneWidth', () => {
  it('uses the minimum width on narrow terminals', () => {
    expect(calculateProjectPaneWidth(60)).toBe(20);
  });

  it('uses 28 percent of terminal width when within bounds', () => {
    expect(calculateProjectPaneWidth(100)).toBe(28);
  });

  it('uses the maximum width on wide terminals', () => {
    expect(calculateProjectPaneWidth(160)).toBe(32);
  });

  it('keeps at least 48 columns available for the session pane', () => {
    expect(calculateProjectPaneWidth(68)).toBe(20);
    expect(calculateProjectPaneWidth(72)).toBe(20);
  });

  it('falls back to a normal terminal width when stdout columns are unavailable', () => {
    expect(calculateProjectPaneWidth(undefined)).toBe(22);
  });
});

describe('calculatePaneWidths', () => {
  it('splits a 120-column terminal into explicit project and session widths', () => {
    expect(calculatePaneWidths(120)).toEqual({
      projectPaneWidth: 32,
      sessionPaneWidth: 88,
    });
  });

  it('splits a 160-column terminal while keeping total width unchanged', () => {
    const widths = calculatePaneWidths(160);

    expect(widths).toEqual({
      projectPaneWidth: 32,
      sessionPaneWidth: 128,
    });
    expect(widths.projectPaneWidth + widths.sessionPaneWidth).toBe(160);
  });

  it('splits the observed 183-column threshold without losing columns', () => {
    const widths = calculatePaneWidths(183);

    expect(widths).toEqual({
      projectPaneWidth: 32,
      sessionPaneWidth: 151,
    });
    expect(widths.projectPaneWidth + widths.sessionPaneWidth).toBe(183);
  });

  it('keeps the session pane non-negative below the normal supported width', () => {
    expect(calculatePaneWidths(60)).toEqual({
      projectPaneWidth: 20,
      sessionPaneWidth: 40,
    });
  });

  it('uses the default terminal width when columns are unavailable', () => {
    expect(calculatePaneWidths(undefined)).toEqual({
      projectPaneWidth: 22,
      sessionPaneWidth: 58,
    });
  });
});

describe('display width helpers', () => {
  it('counts ASCII characters as one column each', () => {
    expect(getDisplayWidth('abc')).toBe(3);
  });

  it('counts common CJK characters as two columns each', () => {
    expect(getDisplayWidth('自我')).toBe(4);
  });

  it('pads ASCII text to the target display width', () => {
    expect(fillToDisplayWidth('abc', 5)).toBe('abc  ');
  });

  it('pads CJK text to the target display width', () => {
    expect(fillToDisplayWidth('自我', 5)).toBe('自我 ');
  });

  it('does not truncate text wider than the target display width', () => {
    expect(fillToDisplayWidth('abcdef', 3)).toBe('abcdef');
  });
});
