import React from 'react';
import { describe, expect, it } from 'vitest';
import SessionList from '../../src/components/SessionList.js';
import type { Project, Session } from '../../src/core/types.js';

const project: Project = {
  name: 'accounting-agent',
  encodedPath: '-Users-test-accounting-agent',
  fullPath: '/tmp/accounting-agent',
  sessionCount: 1,
  totalSize: 1000,
};

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    uuid: 'aaa11111-2222-3333-4444-555566667777',
    project,
    label: '自我介绍和选择企业修改以及一个很长的中文标题',
    labelSource: 'custom-title',
    modifiedAt: new Date(2026, 5, 6, 18, 48),
    size: 1234567,
    isActive: false,
    artifactDirExists: false,
    ...overrides,
  };
}

function getSessionItem(element: React.ReactElement): React.ReactElement {
  const rootChildren = React.Children.toArray(element.props.children) as React.ReactElement[];
  return rootChildren[0] as React.ReactElement;
}

function getSessionColumns(element: React.ReactElement): React.ReactElement[] {
  const item = getSessionItem(element);
  return React.Children.toArray(item.props.children) as React.ReactElement[];
}

function getColumnText(column: React.ReactElement): React.ReactElement {
  return React.Children.toArray(column.props.children)[0] as React.ReactElement;
}

describe('SessionList layout', () => {
  it('renders label and timestamp as fixed row columns', () => {
    const element = SessionList({
      sessions: [makeSession()],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const columns = getSessionColumns(element);

    expect(columns).toHaveLength(2);
    expect(columns[0].props.flexGrow).toBe(1);
    expect(columns[0].props.overflowX).toBe('hidden');
    expect(columns[1].props.width).toBe(12);
    expect(columns[1].props.flexShrink).toBe(0);
    expect(columns[1].props.justifyContent).toBeUndefined();
  });

  it('truncates CJK labels instead of wrapping', () => {
    const element = SessionList({
      sessions: [makeSession()],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const columns = getSessionColumns(element);
    const labelText = getColumnText(columns[0] as React.ReactElement);

    expect(labelText.props.wrap).toBe('truncate');
  });

  it('shows timestamp only and does not include file size in row metadata', () => {
    const element = SessionList({
      sessions: [makeSession()],
      selectedIndex: 0,
      isFocused: false,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const columns = getSessionColumns(element);
    const timestampText = getColumnText(columns[1] as React.ReactElement);

    expect(timestampText.props.children).toBe('06-06 18:48');
  });

  it('uses active green background without appending an active marker', () => {
    const element = SessionList({
      sessions: [makeSession({ isActive: true })],
      selectedIndex: 0,
      isFocused: false,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const columns = getSessionColumns(element);
    const labelText = getColumnText(columns[0] as React.ReactElement);

    expect(labelText.props.backgroundColor).toBe('green');
    expect(JSON.stringify(labelText.props.children)).not.toContain(' *');
  });

  it('pads highlighted timestamp text inside the timestamp column', () => {
    const element = SessionList({
      sessions: [makeSession({ label: 'short' })],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const columns = getSessionColumns(element);
    const timestampText = getColumnText(columns[1] as React.ReactElement);

    expect(timestampText.props.backgroundColor).toBe('cyan');
    expect(timestampText.props.children).toBe(' 06-06 18:48');
  });

  it('fills highlighted label text with trailing spaces', () => {
    const element = SessionList({
      sessions: [makeSession({ label: 'short' })],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
    });

    const columns = getSessionColumns(element);
    const labelText = getColumnText(columns[0] as React.ReactElement);
    const labelParts = React.Children.toArray(labelText.props.children) as React.ReactElement[];
    const labelContent = React.Children.toArray(labelParts[1].props.children).join('');

    expect(labelText.props.backgroundColor).toBe('cyan');
    expect(labelContent.startsWith(' short')).toBe(true);
    expect(labelContent.endsWith(' '.repeat(1000))).toBe(true);
  });
});
