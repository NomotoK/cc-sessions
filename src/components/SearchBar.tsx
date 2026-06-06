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
}

export default function SearchBar({
  active,
  query,
  onQueryChange,
  onSubmit,
  onCancel,
  projectName,
}: SearchBarProps): React.ReactElement {
  return (
    <Box>
      <Text bold color="cyan">Sessions: </Text>
      <Text color="cyan">{projectName}</Text>
      <Text> </Text>
      {active ? (
        <>
          <Text>{'>'}</Text>
          <TextInput
            value={query}
            onChange={onQueryChange}
            onSubmit={onSubmit}
            placeholder="type to search..."
          />
        </>
      ) : (
        <Text dimColor>{query || 'press / to search'}</Text>
      )}
    </Box>
  );
}
