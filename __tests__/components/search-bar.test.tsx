import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import SearchBar from '../../src/components/SearchBar.js';

function flattenElements(children: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flattenElements(child.props.children);
    }

    return React.isValidElement(child) ? [child] : [];
  });
}

function renderSearchBar(overrides: Partial<React.ComponentProps<typeof SearchBar>> = {}) {
  return SearchBar({
    active: false,
    query: '',
    onQueryChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    projectName: 'accounting-agent-with-a-very-long-name',
    width: 40,
    ...overrides,
  });
}

describe('SearchBar layout', () => {
  it('applies the explicit session pane width to the root box', () => {
    const element = renderSearchBar({ width: 52 });

    expect(element.props.width).toBe(52);
  });

  it('bounds and truncates the project name segment', () => {
    const element = renderSearchBar();
    const children = flattenElements(element.props.children);
    const projectNameBox = children[1] as React.ReactElement;
    const projectNameText = React.Children.toArray(projectNameBox.props.children)[0] as React.ReactElement;

    expect(projectNameBox.props.flexGrow).toBe(1);
    expect(projectNameBox.props.overflowX).toBe('hidden');
    expect(projectNameText.props.wrap).toBe('truncate');
  });

  it('bounds and truncates inactive prompt text', () => {
    const element = renderSearchBar({ query: 'a very long search query that must stay bounded' });
    const children = flattenElements(element.props.children);
    const promptBox = children[3] as React.ReactElement;
    const promptText = React.Children.toArray(promptBox.props.children)[0] as React.ReactElement;

    expect(promptBox.props.width).toBe(18);
    expect(promptBox.props.overflowX).toBe('hidden');
    expect(promptText.props.wrap).toBe('truncate');
  });

  it('keeps active TextInput inside a bounded flex child', () => {
    const element = renderSearchBar({ active: true });
    const children = flattenElements(element.props.children);
    const inputBox = children[4] as React.ReactElement;

    expect(inputBox.props.flexGrow).toBe(1);
    expect(inputBox.props.overflowX).toBe('hidden');
  });
});
