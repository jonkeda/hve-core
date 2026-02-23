import * as vscode from 'vscode';
import {
  type TrackingInstance,
  type AuxiliaryState,
  type PhaseState,
  type TrackingDocument,
  type LifecycleMarker,
  type WorkflowConfig,
} from '../models/trackingTypes';
import { type WorkflowLoader } from './workflowLoader';

export class TrackingManager {
  private cache: Map<string, TrackingInstance[]> = new Map();
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly workflowLoader: WorkflowLoader) {}

  /** Scan all tracking categories and return discovered instances. */
  async initialize(): Promise<TrackingInstance[]> {
    this.cache.clear();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return [];

    const trackingUri = vscode.Uri.joinPath(workspaceFolder.uri, '.copilot-tracking');
    try {
      await vscode.workspace.fs.stat(trackingUri);
    } catch (err) {
      console.warn(`TrackingManager: .copilot-tracking not found at ${trackingUri.toString()}:`, err);
      return [];
    }

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(trackingUri);
    } catch (err) {
      console.warn(`TrackingManager: cannot read ${trackingUri.toString()}:`, err);
      return [];
    }

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.Directory) continue;
      const config = this.workflowLoader.getConfig(name);
      if (!config) {
        console.warn(`TrackingManager: no workflow config for category "${name}" (loaded configs: ${[...this.workflowLoader.getAllConfigs().map((c) => c.category)].join(', ') || 'none'})`);
        continue;
      }

      const catUri = vscode.Uri.joinPath(trackingUri, name);
      const instances = await this.scanCategory(catUri, config);
      this.cache.set(name.toLowerCase(), instances);
    }

    return this.getInstances();
  }

  /** Re-scan a single category or all categories and fire change event. */
  async refresh(affectedPath?: string): Promise<void> {
    if (affectedPath) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const relative = affectedPath.replace(/\\/g, '/');
        const trackingPrefix = '.copilot-tracking/';
        const idx = relative.indexOf(trackingPrefix);
        if (idx !== -1) {
          const afterPrefix = relative.slice(idx + trackingPrefix.length);
          const category = afterPrefix.split('/')[0];
          const config = this.workflowLoader.getConfig(category);
          if (config) {
            const catUri = vscode.Uri.joinPath(workspaceFolder.uri, '.copilot-tracking', category);
            const instances = await this.scanCategory(catUri, config);
            this.cache.set(category.toLowerCase(), instances);
            this._onDidChange.fire();
            return;
          }
        }
      }
    }
    await this.initialize();
    this._onDidChange.fire();
  }

  /** Return instances, optionally filtered by category. */
  getInstances(category?: string): TrackingInstance[] {
    if (category) return this.cache.get(category.toLowerCase()) ?? [];
    return [...this.cache.values()].flat();
  }

  /** Find a specific instance by category and folder name. */
  getInstance(category: string, instanceName: string): TrackingInstance | undefined {
    const instances = this.cache.get(category.toLowerCase());
    if (!instances) return undefined;
    return instances.find((i) => `${i.number}_${i.name}` === instanceName);
  }

  private async scanCategory(catUri: vscode.Uri, config: WorkflowConfig): Promise<TrackingInstance[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(catUri);
    } catch {
      return [];
    }

    const instances: TrackingInstance[] = [];
    const instancePattern = /^\d{2,}_/;

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.Directory || !instancePattern.test(name)) continue;
      try {
        const instanceUri = vscode.Uri.joinPath(catUri, name);
        instances.push(await this.scanInstance(instanceUri, config));
      } catch {
        // Skip malformed instance folders
      }
    }

    return instances;
  }

  private async scanInstance(instanceUri: vscode.Uri, config: WorkflowConfig): Promise<TrackingInstance> {
    const folderName = instanceUri.path.split('/').pop()!;
    const nameMatch = folderName.match(/^(\d{2,})_(.+)$/);
    const number = nameMatch?.[1] ?? '00';
    const name = nameMatch?.[2] ?? folderName;

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(instanceUri);
    } catch {
      entries = [];
    }

    const entryNames = new Set(entries.filter(([, t]) => t === vscode.FileType.Directory).map(([n]) => n));
    const phases: PhaseState[] = [];
    let maxModified = 0;

    for (const phaseDef of config.phases) {
      const phaseFolder = phaseDef.folder.replace(/\/$/, '');
      const documents: TrackingDocument[] = [];

      if (entryNames.has(phaseFolder)) {
        const phaseUri = vscode.Uri.joinPath(instanceUri, phaseFolder);
        try {
          const phaseEntries = await vscode.workspace.fs.readDirectory(phaseUri);
          for (const [fileName, fileType] of phaseEntries) {
            if (fileType !== vscode.FileType.File || !fileName.endsWith('.md')) continue;
            const fileUri = vscode.Uri.joinPath(phaseUri, fileName);
            try {
              const stat = await vscode.workspace.fs.stat(fileUri);
              const modified = stat.mtime;
              if (modified > maxModified) maxModified = modified;
              const title = await this.extractTitle(fileUri);
              documents.push({ name: fileName, path: fileUri.fsPath, title, modified });
            } catch {
              // Skip unreadable files
            }
          }
        } catch {
          // Treat unreadable phase folder as empty
        }
      }

      phases.push({
        id: phaseDef.id,
        label: phaseDef.label,
        icon: phaseDef.icon,
        documents,
        status: 'empty',
      });
    }

    const auxFolders: AuxiliaryState[] = [];
    for (const auxDef of config.auxiliaryFolders) {
      const auxFolder = auxDef.folder.replace(/\/$/, '');
      const auxDocuments: TrackingDocument[] = [];

      if (entryNames.has(auxFolder)) {
        const auxUri = vscode.Uri.joinPath(instanceUri, auxFolder);
        try {
          const auxEntries = await vscode.workspace.fs.readDirectory(auxUri);
          for (const [fileName, fileType] of auxEntries) {
            if (fileType !== vscode.FileType.File || !fileName.endsWith('.md')) continue;
            const fileUri = vscode.Uri.joinPath(auxUri, fileName);
            try {
              const stat = await vscode.workspace.fs.stat(fileUri);
              const modified = stat.mtime;
              if (modified > maxModified) maxModified = modified;
              const title = await this.extractTitle(fileUri);
              auxDocuments.push({ name: fileName, path: fileUri.fsPath, title, modified });
            } catch {
              // Skip unreadable files
            }
          }
        } catch {
          // Treat unreadable auxiliary folder as empty
        }
      }

      auxFolders.push({ id: auxDef.id, label: auxDef.label, documents: auxDocuments });
    }

    const activePhase = this.determineActivePhase(phases);
    const lifecycle = await this.readLifecycle(instanceUri);

    return {
      category: config.category,
      number,
      name,
      path: instanceUri.fsPath,
      activePhase,
      lifecycle: lifecycle.status,
      phases,
      auxiliaryFolders: auxFolders,
      lastModified: maxModified,
    };
  }

  private determineActivePhase(phases: PhaseState[]): string {
    let lastWithDocs = -1;
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].documents.length > 0) lastWithDocs = i;
    }

    if (lastWithDocs === -1) {
      // No documents anywhere — first phase is active
      if (phases.length > 0) phases[0].status = 'active';
      return phases[0]?.id ?? '';
    }

    for (let i = 0; i < phases.length; i++) {
      if (i < lastWithDocs) phases[i].status = 'complete';
      else if (i === lastWithDocs) phases[i].status = 'active';
      else phases[i].status = 'empty';
    }

    return phases[lastWithDocs].id;
  }

  private async extractTitle(fileUri: vscode.Uri): Promise<string> {
    try {
      const raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
      let content = raw;
      const fmMatch = content.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
      if (fmMatch) content = content.slice(fmMatch[0].length);

      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) return headingMatch[1].trim();
    } catch {
      // Fall through to filename fallback
    }

    const fileName = fileUri.path.split('/').pop() ?? '';
    return fileName.replace(/\.md$/, '');
  }

  private async readLifecycle(instanceUri: vscode.Uri): Promise<LifecycleMarker> {
    try {
      const lifecycleUri = vscode.Uri.joinPath(instanceUri, '.lifecycle');
      const raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(lifecycleUri));
      const result: LifecycleMarker = { status: 'active' };
      for (const line of raw.split('\n')) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (!match) continue;
        const key = match[1];
        const value = match[2].trim();
        if (key === 'status' && (value === 'active' || value === 'paused' || value === 'archived')) {
          result.status = value;
        } else if (key === 'reason') {
          result.reason = value;
        } else if (key === 'updated') {
          result.updated = value;
        }
      }
      return result;
    } catch {
      return { status: 'active' };
    }
  }
}
