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

function getProjectColumns(element: React.ReactElement): React.ReactElement[] {
  const item = getProjectItem(element);
  return React.Children.toArray(item.props.children) as React.ReactElement[];
}

function getColumnText(column: React.ReactElement): React.ReactElement {
  return React.Children.toArray(column.props.children)[0] as React.ReactElement;
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

    const columns = getProjectColumns(element);

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

    const columns = getProjectColumns(element);
    const nameColumn = columns[0] as React.ReactElement;
    const nameText = getColumnText(nameColumn);

    expect(nameText.props.wrap).toBe('truncate');
  });

  it('fills the selected name column highlight with trailing spaces', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 48,
    });

    const columns = getProjectColumns(element);
    const nameText = getColumnText(columns[0] as React.ReactElement);
    const renderedName = React.Children.toArray(nameText.props.children).join('');

    expect(nameText.props.backgroundColor).toBe('cyan');
    expect(renderedName).toBe(`> ${projects[0].name}${' '.repeat(42)}`);
  });

  it('fills the deleting name column highlight with trailing spaces', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: 0,
      width: 48,
    });

    const columns = getProjectColumns(element);
    const nameText = getColumnText(columns[0] as React.ReactElement);
    const renderedName = React.Children.toArray(nameText.props.children).join('');

    expect(nameText.props.backgroundColor).toBe('red');
    expect(nameText.props.bold).toBe(true);
    expect(renderedName).toBe(`> ${projects[0].name}${' '.repeat(42)}`);
  });

  it('truncates count text that is wider than the fixed count column', () => {
    const element = ProjectList({
      projects: [{ ...projects[0], sessionCount: 123456789 }],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    const columns = getProjectColumns(element);
    const countText = getColumnText(columns[1] as React.ReactElement);

    expect(countText.props.wrap).toBe('truncate');
  });
});
