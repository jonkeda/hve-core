/** A single artifact entry in the bundled manifest. */
export interface ManifestEntry {
  name: string;
  type: 'agent' | 'prompt' | 'instruction';
  /** Path relative to the bundled/ directory inside the VSIX (e.g., "agents/task-planner.agent.md"). */
  relativePath: string;
  description: string;
  /** Functional domain from frontmatter (e.g., "Azure DevOps", "RPI"). */
  category?: string;
  /** Agent name from prompt frontmatter — links a prompt to its agent. */
  agent?: string;
  /** Prompt name from instruction frontmatter — links an instruction to its parent prompt. */
  prompt?: string;
}

/** Bundled manifest listing all artifacts shipped with the extension. */
export interface BundledManifest {
  artifacts: ManifestEntry[];
}
