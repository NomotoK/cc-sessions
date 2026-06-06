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

const shortProjects: Project[] = [
  {
    name: 'acct',
    encodedPath: '-Users-test-acct',
    fullPath: '/tmp/acct',
    sessionCount: 3,
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
    expect(columns[1].props.justifyContent).toBeUndefined();
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

  it('fills the selected name column highlight exactly to the label width', () => {
    const element = ProjectList({
      projects: shortProjects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    const columns = getProjectColumns(element);
    const nameText = getColumnText(columns[0] as React.ReactElement);
    const renderedName = React.Children.toArray(nameText.props.children).join('');

    expect(nameText.props.backgroundColor).toBe('cyan');
    expect(renderedName).toBe(`> ${shortProjects[0].name}${' '.repeat(10)}`);
  });

  it('fills the deleting name column highlight exactly to the label width', () => {
    const element = ProjectList({
      projects: shortProjects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: 0,
      width: 22,
    });

    const columns = getProjectColumns(element);
    const nameText = getColumnText(columns[0] as React.ReactElement);
    const renderedName = React.Children.toArray(nameText.props.children).join('');

    expect(nameText.props.backgroundColor).toBe('red');
    expect(nameText.props.bold).toBe(true);
    expect(renderedName).toBe(`> ${shortProjects[0].name}${' '.repeat(10)}`);
  });

  it('pads short count text inside the highlighted count column', () => {
    const element = ProjectList({
      projects,
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    const columns = getProjectColumns(element);
    const countText = getColumnText(columns[1] as React.ReactElement);
    const renderedCount = React.Children.toArray(countText.props.children).join('');

    expect(countText.props.backgroundColor).toBe('cyan');
    expect(renderedCount).toBe('  (31)');
  });

  it('keeps large count text unpadded and truncating inside the count column', () => {
    const element = ProjectList({
      projects: [{ ...projects[0], sessionCount: 123456 }],
      selectedIndex: 0,
      isFocused: true,
      visibleHeight: 5,
      deletingIndex: null,
      width: 22,
    });

    const columns = getProjectColumns(element);
    const countText = getColumnText(columns[1] as React.ReactElement);
    const renderedCount = React.Children.toArray(countText.props.children).join('');

    expect(countText.props.wrap).toBe('truncate');
    expect(renderedCount).toBe('(123456)');
  });
});
