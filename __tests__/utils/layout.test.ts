import { describe, expect, it } from 'vitest';
import { calculateProjectPaneWidth } from '../../src/utils/layout.js';

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
