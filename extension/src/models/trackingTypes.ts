/** A discovered tracking instance (e.g., Task/01_ExtensionUI). */
export interface TrackingInstance {
  category: string;
  number: string;
  name: string;
  path: string;
  activePhase: string;
  lifecycle: 'active' | 'paused' | 'archived';
  phases: PhaseState[];
  auxiliaryFolders: AuxiliaryState[];
  lastModified: number;
}

/** Runtime state of a single phase within an instance. */
export interface PhaseState {
  id: string;
  label: string;
  icon: string;
  documents: TrackingDocument[];
  status: 'empty' | 'active' | 'complete';
}

/** Runtime state of an auxiliary folder within an instance. */
export interface AuxiliaryState {
  id: string;
  label: string;
  documents: TrackingDocument[];
}

/** A markdown document found inside a phase folder. */
export interface TrackingDocument {
  name: string;
  path: string;
  title: string;
  modified: number;
}

/** Parsed workflow configuration from a .workflow.md file. */
export interface WorkflowConfig {
  category: string;
  displayName: string;
  icon: string;
  phases: PhaseDefinition[];
  auxiliaryFolders: AuxiliaryFolder[];
  lifecycleStates: string[];
  instancePattern: string;
}

/** A phase definition from workflow YAML frontmatter. */
export interface PhaseDefinition {
  id: string;
  label: string;
  icon: string;
  folder: string;
  agent?: string;
  prompt?: string;
  branches?: PhaseDefinition[];
  feedbackTo?: string[];
}

/** A non-phase subfolder shown in the tree but not in the timeline stepper. */
export interface AuxiliaryFolder {
  id: string;
  label: string;
  folder: string;
}

/** Lifecycle marker file content. */
export interface LifecycleMarker {
  status: 'active' | 'paused' | 'archived';
  reason?: string;
  updated?: string;
}
