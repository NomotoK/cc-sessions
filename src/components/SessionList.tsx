import React from 'react';
import { Box, Text } from 'ink';
import type { Session, LabelSource } from '../core/types.js';
import { fillToDisplayWidth } from '../utils/layout.js';

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
  isFocused: boolean;
  visibleHeight: number;
  deletingIndex: number | null;
  width: number;
}

function formatDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${m}-${d} ${h}:${min}`;
}

function labelIcon(source: LabelSource): { char: string; color: string } {
  switch (source) {
    case 'custom-title':
      return { char: '*', color: 'yellow' };
    case 'ai-title':
      return { char: '#', color: 'blue' };
    default:
      return { char: ' ', color: '' };
  }
}

const TIMESTAMP_COLUMN_WIDTH = 12;

export default function SessionList({
  sessions,
  selectedIndex,
  isFocused,
  visibleHeight,
  deletingIndex,
  width,
}: SessionListProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Text dimColor>No sessions</Text>
      </Box>
    );
  }

  // Each session takes 1 line
  const sessionsPerScreen = Math.max(1, visibleHeight);
  const halfScreen = Math.floor(sessionsPerScreen / 2);
  let startIndex = Math.max(0, selectedIndex - halfScreen);
  const maxStartIndex = Math.max(0, sessions.length - sessionsPerScreen);
  startIndex = Math.min(startIndex, maxStartIndex);
  const endIndex = Math.min(sessions.length, startIndex + sessionsPerScreen);

  const visibleSessions = sessions.slice(startIndex, endIndex);
  const labelColumnWidth = Math.max(0, width - TIMESTAMP_COLUMN_WIDTH);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleSessions.map((session, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;
        const isDeleting = deletingIndex === actualIndex;
        const icon = labelIcon(session.labelSource);
        const timestamp = formatDate(session.modifiedAt);
        const isSelectedFocused = isSelected && isFocused;

        let rowBg: string | undefined;
        let rowFg: string | undefined;
        let bold = false;

        if (isDeleting) {
          rowBg = 'red';
          rowFg = 'white';
          bold = true;
        } else if (isSelectedFocused) {
          rowBg = 'cyan';
          rowFg = 'black';
        } else if (session.isActive) {
          rowBg = 'green';
          rowFg = 'black';
        }

        const iconColor = rowFg ?? icon.color;
        const timestampText = rowBg ? timestamp.padStart(TIMESTAMP_COLUMN_WIDTH) : timestamp;
        const iconText = icon.char === ' ' ? '  ' : icon.char;
        const labelContent = `${iconText} ${session.label}`;
        const filledLabelContent = rowBg
          ? fillToDisplayWidth(labelContent, labelColumnWidth)
          : labelContent;
        const labelText = filledLabelContent.slice(iconText.length);

        return (
          <Box key={session.uuid}>
            <Box flexGrow={1} overflowX="hidden">
              <Text
                wrap="truncate"
                color={rowFg}
                backgroundColor={rowBg}
                bold={bold}
              >
                {icon.char === ' ' ? (
                  <Text color={rowFg} backgroundColor={rowBg}>{iconText}</Text>
              ) : (
                  <Text color={iconColor} backgroundColor={rowBg}>{icon.char}</Text>
              )}
                <Text color={rowFg} backgroundColor={rowBg}>{labelText}</Text>
              </Text>
            </Box>
            <Box width={TIMESTAMP_COLUMN_WIDTH} flexShrink={0}>
              <Text
                color={rowFg}
                backgroundColor={rowBg}
                bold={bold}
                dimColor={!isSelectedFocused && !session.isActive && !isDeleting}
              >
                {timestampText}
              </Text>
            </Box>
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {sessions.length > sessionsPerScreen && (
        <Box>
          <Text dimColor>({selectedIndex + 1}/{sessions.length})</Text>
        </Box>
      )}
    </Box>
  );
}
