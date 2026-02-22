import { describe, it, expect } from 'vitest';
import { inferDomain } from '../../../models/types';

describe('inferDomain', () => {
  it('maps ado- prefix to Azure DevOps', () => {
    expect(inferDomain('ado-create-pull-request')).toBe('Azure DevOps');
  });

  it('maps task- prefix to RPI', () => {
    expect(inferDomain('task-researcher')).toBe('RPI');
  });

  it('maps rpi prefix to RPI', () => {
    expect(inferDomain('rpi-agent')).toBe('RPI');
  });

  it('maps git- prefix to Git', () => {
    expect(inferDomain('git-commit')).toBe('Git');
  });

  it('maps github- prefix to GitHub', () => {
    expect(inferDomain('github-backlog-manager')).toBe('GitHub');
  });

  it('maps prompt- prefix to Prompt Engineering', () => {
    expect(inferDomain('prompt-builder')).toBe('Prompt Engineering');
  });

  it('maps doc- prefix to Documentation', () => {
    expect(inferDomain('doc-ops')).toBe('Documentation');
  });

  it('maps gen- prefix to Data Science', () => {
    expect(inferDomain('gen-data-spec')).toBe('Data Science');
  });

  it('maps test- prefix to Data Science', () => {
    expect(inferDomain('test-streamlit-dashboard')).toBe('Data Science');
  });

  it('maps -builder suffix to Document Builders', () => {
    expect(inferDomain('prd-builder')).toBe('Document Builders');
  });

  it('maps -creation suffix to Document Builders', () => {
    expect(inferDomain('adr-creation')).toBe('Document Builders');
  });

  it('maps instruction- prefix to Instruction Generation', () => {
    expect(inferDomain('instruction-analyzer')).toBe('Instruction Generation');
  });

  it('maps security- prefix to Security', () => {
    expect(inferDomain('security-plan-creator')).toBe('Security');
  });

  it('returns General for unmatched names', () => {
    expect(inferDomain('memory')).toBe('General');
  });

  it('returns General for empty string', () => {
    expect(inferDomain('')).toBe('General');
  });
});
