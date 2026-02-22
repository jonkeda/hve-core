/** A single artifact entry in the bundled manifest. */
export interface ManifestEntry {
  name: string;
  type: 'agent' | 'prompt' | 'instruction';
  /** Path relative to the bundled/ directory inside the VSIX (e.g., "agents/task-planner.agent.md"). */
  relativePath: string;
  description: string;
}

/** Bundled manifest listing all artifacts shipped with the extension. */
export interface BundledManifest {
  artifacts: ManifestEntry[];
}
