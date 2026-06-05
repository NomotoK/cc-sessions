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
        <Text>[y] 确认删除    [Esc/N] 取消</Text>
      </Box>
    );
  }

  if (searchActive) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text>[Enter] 确认搜索    [Esc] 取消搜索</Text>
      </Box>
    );
  }

  const shortcuts: string[] = ['↑↓/jk 浏览', 'Tab 切换栏'];

  if (focusedPane === 'session') {
    shortcuts.push('Enter 恢复', 'Space 标记', 'D 删除', '/ 搜索');
  } else {
    shortcuts.push('Shift+D 删除项目全部');
  }

  shortcuts.push('q 退出');

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>{shortcuts.join('  ')}</Text>
    </Box>
  );
}
