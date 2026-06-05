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
      <Text bold>Sessions: </Text>
      <Text color="cyan">{projectName}</Text>
      <Text> </Text>
      {active ? (
        <>
          <Text>🔍</Text>
          <TextInput
            value={query}
            onChange={onQueryChange}
            onSubmit={onSubmit}
            placeholder="输入搜索关键词..."
          />
        </>
      ) : (
        <Text dimColor>{query || '按 / 搜索'}</Text>
      )}
    </Box>
  );
}
