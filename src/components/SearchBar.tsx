import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface SearchBarProps {
  active: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  projectName: string;
  width: number;
}

const INACTIVE_PROMPT_WIDTH = 18;

export default function SearchBar({
  active,
  query,
  onQueryChange,
  onSubmit,
  onCancel,
  projectName,
  width,
}: SearchBarProps): React.ReactElement {
  return (
    <Box width={width}>
      <Text bold color="cyan">Sessions: </Text>
      <Box flexGrow={1} overflowX="hidden">
        <Text wrap="truncate" color="cyan">{projectName}</Text>
      </Box>
      <Text> </Text>
      {active ? (
        <>
          <Text>{'>'}</Text>
          <Box flexGrow={1} overflowX="hidden">
            <TextInput
              value={query}
              onChange={onQueryChange}
              onSubmit={onSubmit}
              placeholder="type to search..."
            />
          </Box>
        </>
      ) : (
        <Box width={INACTIVE_PROMPT_WIDTH} overflowX="hidden">
          <Text wrap="truncate" dimColor>{query || 'press / to search'}</Text>
        </Box>
      )}
    </Box>
  );
}
