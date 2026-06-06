import React from 'react';
import { describe, expect, it } from 'vitest';
import ProjectList from '../../src/components/ProjectList.js';
import type { Project } from '../../src/core/types.js';

const projects: Project[] = [
  {
    name: 'accounting-agent-with-a-very-long-name',
    encodedPath: '-Users-test-accounting-agent-with-a-very-long-name',
    fullPath: '/tmp/accounting-agent-with-a-very-long-name',
    sessionCount: 31,
    totalSize: 1000,
  },
];

function getProjectItem(element: React.ReactElement): React.ReactElement {
  const rootChildren = React.Children.toArray(element.props.children) as React.ReactElement[];
  return rootChildren[2] as React.ReactElement;
}

describe('ProjectList layout', () => {
  it('uses the width passed from App for the project pane', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    expect(element.props.width).toBe(22);
  });

  it('renders project name and count as separate fixed columns', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    const item = getProjectItem(element);
    const columns = React.Children.toArray(item.props.children) as React.ReactElement[];

    expect(columns).toHaveLength(2);
    expect(columns[0].props.flexGrow).toBe(1);
    expect(columns[0].props.overflowX).toBe('hidden');
    expect(columns[1].props.width).toBe(6);
    expect(columns[1].props.flexShrink).toBe(0);
  });

  it('truncates the project name text instead of wrapping', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    const item = getProjectItem(element);
    const columns = React.Children.toArray(item.props.children) as React.ReactElement[];
    const nameColumn = columns[0] as React.ReactElement;
    const nameText = React.Children.toArray(nameColumn.props.children)[0] as React.ReactElement;

    expect(nameText.props.wrap).toBe('truncate');
  });
});
