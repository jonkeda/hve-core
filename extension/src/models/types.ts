/** Artifact type as declared in package.json contributes sections. */
export type ArtifactType = 'agent' | 'prompt' | 'instruction';

/** An artifact entry with its current enabled state. */
export interface ArtifactItem {
  name: string;
  type: ArtifactType;
  /** Relative path within the bundled directory. */
  path: string;
  description: string;
  /** Whether the artifact is currently enabled (present in workspace). */
  enabled: boolean;
}

/** Frontmatter fields parsed on-demand from artifact markdown files. */
export interface ArtifactFrontmatter {
  description?: string;
  maturity?: string;
  handoffs?: HandoffEntry[];
  argumentHint?: string;
  tools?: string[];
  agent?: string;
  applyTo?: string;
}

/** A handoff entry from agent frontmatter. */
export interface HandoffEntry {
  label: string;
  agent?: string;
  prompt?: string;
  send?: string;
}

/** Discriminated union for tree elements: category headers or artifact items. */
export type TreeElement =
  | { kind: 'category'; label: string }
  | { kind: 'artifact'; item: ArtifactItem };

/** Functional domain grouping derived from artifact naming conventions. */
export type ArtifactDomain =
  | 'Azure DevOps'
  | 'RPI'
  | 'Git'
  | 'GitHub'
  | 'Prompt Engineering'
  | 'Documentation'
  | 'Data Science'
  | 'Document Builders'
  | 'Instruction Generation'
  | 'Security'
  | 'General';

/** Maps artifact name prefix patterns to functional domains. */
export function inferDomain(name: string): ArtifactDomain {
  if (name.startsWith('ado-')) return 'Azure DevOps';
  if (name.startsWith('task-') || name.startsWith('rpi')) return 'RPI';
  if (name.startsWith('git-')) return 'Git';
  if (name.startsWith('github-')) return 'GitHub';
  if (name.startsWith('prompt-')) return 'Prompt Engineering';
  if (name.startsWith('doc-')) return 'Documentation';
  if (name.startsWith('gen-') || name.startsWith('test-')) return 'Data Science';
  if (name.endsWith('-builder') || name.endsWith('-creation')) return 'Document Builders';
  if (name.startsWith('instruction-')) return 'Instruction Generation';
  if (name.startsWith('security-')) return 'Security';
  return 'General';
}
