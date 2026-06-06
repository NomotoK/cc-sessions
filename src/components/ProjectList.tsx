import React from 'react';
import { Box, Text } from 'ink';
import type { Project } from '../core/types.js';

interface ProjectListProps {
  projects: Project[];
  selectedIndex: number;
  isFocused: boolean;
  visibleHeight: number;
  deletingIndex: number | null;
  width: number;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

export default function ProjectList({
  projects,
  selectedIndex,
  isFocused,
  visibleHeight,
  deletingIndex,
  width,
}: ProjectListProps): React.ReactElement {
  const COLUMN_WIDTH = width;

  // Calculate scroll window
  const halfHeight = Math.floor(visibleHeight / 2);
  let startIndex = Math.max(0, selectedIndex - halfHeight);
  const maxStartIndex = Math.max(0, projects.length - visibleHeight);
  startIndex = Math.min(startIndex, maxStartIndex);
  const endIndex = Math.min(projects.length, startIndex + visibleHeight);

  const visibleProjects = projects.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column" width={COLUMN_WIDTH}>
      {/* Header */}
      <Box>
        <Text bold color="cyan">{' Projects'}</Text>
      </Box>

      {/* Blank line after title */}
      <Box>
        <Text>{' '}</Text>
      </Box>

      {/* Project items */}
      {visibleProjects.map((project, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;
        const isDeleting = deletingIndex === actualIndex;
        const prefix = isSelected && isFocused ? '> ' : '  ';
        const maxNameLen = COLUMN_WIDTH - prefix.length - 5; // reserve space for " (N)"
        const name = truncate(project.name, maxNameLen);
        const countStr = `(${project.sessionCount})`;

        // Calculate padding to right-align count
        const contentLen = prefix.length + name.length;
        const padding = Math.max(1, COLUMN_WIDTH - contentLen - countStr.length);

        if (isDeleting) {
          return (
            <Box key={project.encodedPath}>
              <Text backgroundColor="red" color="white" bold>
                {prefix}{name}{' '.repeat(padding)}{countStr}
              </Text>
            </Box>
          );
        }

        return (
          <Box key={project.encodedPath}>
            <Text
              color={isSelected && isFocused ? 'black' : undefined}
              backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
            >
              {prefix}{name}
            </Text>
            <Text
              color={isSelected && isFocused ? 'black' : undefined}
              backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
            >
              {' '.repeat(padding)}{countStr}
            </Text>
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {projects.length > visibleHeight && (
        <Box>
          <Text dimColor>({selectedIndex + 1}/{projects.length})</Text>
        </Box>
      )}
    </Box>
  );
}
