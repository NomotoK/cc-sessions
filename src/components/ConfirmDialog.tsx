import React from 'react';
import { Box, Text } from 'ink';
import type { ConfirmAction, LabelSource } from '../core/types.js';

interface ConfirmDialogProps {
  action: ConfirmAction;
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

export default function ConfirmDialog({ action }: ConfirmDialogProps): React.ReactElement {
  const { type, targets, project } = action;

  // Build description
  let description: string;
  if (type === 'delete-project' && project) {
    description = `删除项目 "${project.name}" 的所有会话？`;
  } else {
    description = `删除 ${targets.length} 个会话？`;
  }

  // Show up to 8 targets
  const maxDisplay = 8;
  const displayedTargets = targets.slice(0, maxDisplay);
  const remaining = targets.length - maxDisplay;

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="yellow"
        padding={1}
      >
        {/* Title */}
        <Box>
          <Text bold color="yellow">⚠ 确认删除</Text>
        </Box>

        {/* Description */}
        <Box marginTop={1}>
          <Text>{description}</Text>
        </Box>

        {/* Target list */}
        <Box flexDirection="column" marginTop={1}>
          {displayedTargets.map((session) => (
            <Box key={session.uuid}>
              <Text>{labelIcon(session.labelSource)} {truncate(session.label, 40)}</Text>
            </Box>
          ))}
          {remaining > 0 && (
            <Box>
              <Text dimColor>...及其他 {remaining} 个</Text>
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Box marginTop={1}>
          <Text>[y] 确认删除    [Esc/N] 取消</Text>
        </Box>
      </Box>
    </Box>
  );
}
