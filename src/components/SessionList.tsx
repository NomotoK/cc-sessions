import React from 'react';
import { Box, Text } from 'ink';
import type { Session, LabelSource } from '../core/types.js';

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
  isFocused: boolean;
  visibleHeight: number;
  deletingIndex: number | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
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

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

export default function SessionList({
  sessions,
  selectedIndex,
  isFocused,
  visibleHeight,
  deletingIndex,
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

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleSessions.map((session, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;
        const isDeleting = deletingIndex === actualIndex;
        const icon = labelIcon(session.labelSource);
        const metaStr = `${formatDate(session.modifiedAt)}  ${formatSize(session.size)}`;
        const labelMaxLen = 30;
        const label = truncate(session.label, labelMaxLen);

        // Build the label part: icon + space + label
        const labelText = `${icon.char} ${label}`;

        if (isDeleting) {
          return (
            <Box key={session.uuid} justifyContent="space-between">
              <Text backgroundColor="red" color="white" bold>
                {labelText}
              </Text>
              <Text backgroundColor="red" color="white" bold>
                {metaStr}
              </Text>
            </Box>
          );
        }

        const selectedBg = isSelected && isFocused ? 'cyan' : undefined;
        const selectedFg = isSelected && isFocused ? 'black' : undefined;

        return (
          <Box key={session.uuid} justifyContent="space-between">
            <Text color={selectedFg} backgroundColor={selectedBg}>
              {icon.char === ' ' ? (
                <Text color={selectedFg} backgroundColor={selectedBg}>{'  '}</Text>
              ) : (
                <Text color={isSelected && isFocused ? selectedFg : icon.color} backgroundColor={selectedBg}>{icon.char}</Text>
              )}
              <Text color={selectedFg} backgroundColor={selectedBg}>{' '}{label}</Text>
              {session.isActive && (
                <Text color={isSelected && isFocused ? 'black' : 'green'} backgroundColor={selectedBg}>
                  {' *'}
                </Text>
              )}
            </Text>
            <Text color={selectedFg} backgroundColor={selectedBg} dimColor={!isSelected || !isFocused}>
              {metaStr}
            </Text>
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
