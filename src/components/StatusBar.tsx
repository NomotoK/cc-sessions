import React from 'react';
import { Box, Text } from 'ink';
import type { FocusedPane } from '../core/types.js';

interface StatusBarProps {
  focusedPane: FocusedPane;
  searchActive: boolean;
  confirmVisible: boolean;
}

export default function StatusBar({ focusedPane, searchActive, confirmVisible }: StatusBarProps): React.ReactElement {
  if (confirmVisible) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text><Text dimColor>[y]</Text> confirm delete    <Text dimColor>[Esc/N]</Text> cancel</Text>
      </Box>
    );
  }

  if (searchActive) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text><Text dimColor>[Enter]</Text> search    <Text dimColor>[Esc]</Text> cancel</Text>
      </Box>
    );
  }

  const parts: React.ReactElement[] = [];

  // navigate
  parts.push(<Text key="nav"><Text dimColor>[up/dn/jk]</Text> navigate</Text>);

  // switch pane
  parts.push(<Text key="pane"><Text dimColor>[Tab/LR]</Text> switch pane</Text>);

  // pane-specific shortcuts
  if (focusedPane === 'session') {
    parts.push(<Text key="resume"><Text dimColor>[Enter]</Text> resume</Text>);
    parts.push(<Text key="del"><Text dimColor>[Ctrl+D]</Text> delete</Text>);
    parts.push(<Text key="search"><Text dimColor>[/]</Text> search</Text>);
  } else {
    parts.push(<Text key="delall"><Text dimColor>[Ctrl+D]</Text> delete all</Text>);
  }

  // quit
  parts.push(<Text key="quit"><Text dimColor>[q]</Text> quit</Text>);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} gap={2}>
      {parts}
    </Box>
  );
}
