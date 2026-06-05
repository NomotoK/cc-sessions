import React from 'react';
import { Box, Text } from 'ink';
import type { Session, LabelSource } from '../core/types.js';

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
  markedSessions: Set<string>;
  isFocused: boolean;
  visibleHeight: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function labelIcon(source: LabelSource): string {
  switch (source) {
    case 'custom-title':
      return '★';
    case 'ai-title':
      return '●';
    default:
      return ' ';
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

export default function SessionList({
  sessions,
  selectedIndex,
  markedSessions,
  isFocused,
  visibleHeight,
}: SessionListProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Text dimColor>没有会话</Text>
      </Box>
    );
  }

  // Each session takes 2 lines, so visible session count is half the visible height
  const sessionsPerScreen = Math.max(1, Math.floor(visibleHeight / 2));
  const halfScreen = Math.floor(sessionsPerScreen / 2);
  let startIndex = Math.max(0, selectedIndex - halfScreen);
  const maxStartIndex = Math.max(0, sessions.length - sessionsPerScreen);
  startIndex = Math.min(startIndex, maxStartIndex);
  const endIndex = Math.min(sessions.length, startIndex + sessionsPerScreen);

  const visibleSessions = sessions.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleSessions.map((session, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;
        const isMarked = markedSessions.has(session.uuid);
        const mark = isMarked ? '[x]' : '[ ]';
        const icon = labelIcon(session.labelSource);
        const label = truncate(session.label, 40);

        return (
          <Box key={session.uuid} flexDirection="column">
            {/* Line 1: mark + icon + label + active badge */}
            <Box>
              <Text
                color={isSelected && isFocused ? 'black' : undefined}
                backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
              >
                {mark}{icon} {label}
              </Text>
              {session.isActive && (
                <Text
                  color={isSelected && isFocused ? 'black' : 'green'}
                  backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
                >
                  {' '}●活跃
                </Text>
              )}
            </Box>

            {/* Line 2: date + size */}
            <Box>
              <Text
                color={isSelected && isFocused ? 'black' : undefined}
                backgroundColor={isSelected && isFocused ? 'cyan' : undefined}
                dimColor={!isSelected || !isFocused}
              >
                {'     '}{formatDate(session.modifiedAt)}  {formatSize(session.size)}
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
