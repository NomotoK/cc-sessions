import { describe, it, expect } from 'vitest';
import { PathEncoder } from '../../src/utils/path.js';

describe('PathEncoder', () => {
  describe('encode', () => {
    it('converts absolute path to encoded directory name', () => {
      expect(PathEncoder.encode('/Users/hailin/Code/accounting-agent'))
        .toBe('-Users-hailin-Code-accounting-agent');
    });

    it('handles root path', () => {
      expect(PathEncoder.encode('/')).toBe('-');
    });

    it('handles single-level path', () => {
      expect(PathEncoder.encode('/Users')).toBe('-Users');
    });
  });

  describe('decode', () => {
    it('converts encoded name back to absolute path', () => {
      expect(PathEncoder.decode('-Users-hailin-Code-accounting-agent'))
        .toBe('/Users/hailin/Code/accounting-agent');
    });

    it('handles root encoding', () => {
      expect(PathEncoder.decode('-')).toBe('/');
    });
  });

  describe('extractProjectName', () => {
    it('extracts last segment as project name', () => {
      expect(PathEncoder.extractProjectName('-Users-hailin-Code-accounting-agent'))
        .toBe('accounting-agent');
    });

    it('returns full name for ssh paths', () => {
      expect(PathEncoder.extractProjectName('ssh-server-my-project'))
        .toBe('ssh-server-my-project');
    });

    it('handles short paths', () => {
      expect(PathEncoder.extractProjectName('-Users-hailin'))
        .toBe('hailin');
    });
  });
});
