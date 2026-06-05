import React from 'react';
import { Box, Text } from 'ink';
import type { Project } from '../core/types.js';

interface ProjectListProps {
  projects: Project[];
  selectedIndex: number;
  isFocused: boolean;
  visibleHeight: number;
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
}: ProjectListProps): React.ReactElement {
  // Calculate scroll window
  const halfHeight = Math.floor(visibleHeight / 2);
  let startIndex = Math.max(0, selectedIndex - halfHeight);
  const maxStartIndex = Math.max(0, projects.length - visibleHeight);
  startIndex = Math.min(startIndex, maxStartIndex);
  const endIndex = Math.min(projects.length, startIndex + visibleHeight);

  const visibleProjects = projects.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column" width={22}>
      {/* Header */}
      <Box>
        <Text bold={isFocused} backgroundColor={isFocused ? 'cyan' : undefined} color={isFocused ? 'black' : undefined}>
          {' Projects '}
        </Text>
      </Box>

      {/* Project items */}
      {visibleProjects.map((project, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;
        const prefix = isSelected && isFocused ? '> ' : '  ';
        const name = truncate(project.name, 16);

        return (
          <Box key={project.encodedPath}>
            <Text
              color={isSelected && isFocused ? 'black' : undefined}
              backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
            >
              {prefix}{name}
            </Text>
            <Text dimColor> {project.sessionCount}</Text>
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
