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

const COUNT_COLUMN_WIDTH = 6;

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
        const countStr = `(${project.sessionCount})`;
        const selectedBg = isSelected && isFocused ? 'cyan' : undefined;
        const selectedFg = isSelected && isFocused ? 'black' : undefined;
        const deletingBg = isDeleting ? 'red' : selectedBg;
        const deletingFg = isDeleting ? 'white' : selectedFg;

        return (
          <Box key={project.encodedPath} width={COLUMN_WIDTH}>
            <Box flexGrow={1} overflowX="hidden">
              <Text
                wrap="truncate"
                color={deletingFg}
                backgroundColor={deletingBg}
                bold={isDeleting}
              >
                {prefix}{project.name}
              </Text>
            </Box>
            <Box width={COUNT_COLUMN_WIDTH} flexShrink={0} justifyContent="flex-end">
              <Text
                color={deletingFg}
                backgroundColor={deletingBg}
                bold={isDeleting}
              >
                {countStr}
              </Text>
            </Box>
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
