import * as vscode from 'vscode';
import { type ManifestEntry, type BundledManifest } from '../models/manifest';
import { type ArtifactItem, type ArtifactType } from '../models/types';

const NAMESPACE = 'hve-core';

/** Manages artifact lifecycle: reading from bundled manifest, copying to workspace, removing. */
export class ArtifactManager {
  private manifest: BundledManifest = { artifacts: [] };
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /** Loads the bundled manifest and returns the full artifact list with enabled state. */
  async initialize(): Promise<ArtifactItem[]> {
    this.manifest = await this.readManifest();
    return this.getArtifacts();
  }

  /** Returns all artifacts with current enabled state derived from workspace filesystem. */
  async getArtifacts(): Promise<ArtifactItem[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return this.manifest.artifacts.map((e) => this.toArtifactItem(e, false));
    }

    const items: ArtifactItem[] = [];
    for (const entry of this.manifest.artifacts) {
      const targetUri = this.getWorkspaceTargetUri(workspaceFolder.uri, entry);
      const enabled = await this.fileExists(targetUri);
      items.push(this.toArtifactItem(entry, enabled));
    }
    return items;
  }

  /** Copies a bundled artifact to the workspace, enabling it. */
  async enableArtifact(name: string, type?: ArtifactType): Promise<void> {
    const entry = this.findEntry(name, type);
    if (!entry) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const sourceUri = this.getBundledSourceUri(entry);
    const targetUri = this.getWorkspaceTargetUri(workspaceFolder.uri, entry);

    // Ensure parent directory exists
    const parentUri = vscode.Uri.joinPath(targetUri, '..');
    await vscode.workspace.fs.createDirectory(parentUri);

    const content = await vscode.workspace.fs.readFile(sourceUri);
    await vscode.workspace.fs.writeFile(targetUri, content);
    this._onDidChange.fire();
  }

  /** Removes an artifact from the workspace, disabling it. */
  async disableArtifact(name: string, type?: ArtifactType): Promise<void> {
    const entry = this.findEntry(name, type);
    if (!entry) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const targetUri = this.getWorkspaceTargetUri(workspaceFolder.uri, entry);
    if (await this.fileExists(targetUri)) {
      await vscode.workspace.fs.delete(targetUri);
    }
    this._onDidChange.fire();
  }

  /** Enables all bundled artifacts. */
  async enableAll(): Promise<void> {
    for (const entry of this.manifest.artifacts) {
      await this.enableArtifact(entry.name);
    }
  }

  /** Disables all artifacts. */
  async disableAll(): Promise<void> {
    for (const entry of this.manifest.artifacts) {
      await this.disableArtifact(entry.name);
    }
  }

  /** Enables all artifacts of a given type. */
  async enableByType(type: ArtifactType): Promise<void> {
    for (const entry of this.manifest.artifacts.filter((e) => e.type === type)) {
      await this.enableArtifact(entry.name);
    }
  }

  /** Disables all artifacts of a given type. */
  async disableByType(type: ArtifactType): Promise<void> {
    for (const entry of this.manifest.artifacts.filter((e) => e.type === type)) {
      await this.disableArtifact(entry.name);
    }
  }

  /** Resolves workspace target path: .github/{agents,prompts,instructions}/hve-core/<filename> */
  private getWorkspaceTargetUri(workspaceUri: vscode.Uri, entry: ManifestEntry): vscode.Uri {
    const subdir = this.getSubdirectory(entry.type);
    const filename = entry.relativePath.split('/').pop()!;
    return vscode.Uri.joinPath(workspaceUri, '.github', subdir, NAMESPACE, filename);
  }

  /** Resolves bundled source path: bundled/<relativePath> */
  private getBundledSourceUri(entry: ManifestEntry): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, 'bundled', entry.relativePath);
  }

  private getSubdirectory(type: ManifestEntry['type']): string {
    switch (type) {
      case 'agent': return 'agents';
      case 'prompt': return 'prompts';
      case 'instruction': return 'instructions';
    }
  }

  private findEntry(name: string, type?: ArtifactType): ManifestEntry | undefined {
    if (type) return this.manifest.artifacts.find((e) => e.name === name && e.type === type);
    return this.manifest.artifacts.find((e) => e.name === name);
  }

  private async readManifest(): Promise<BundledManifest> {
    const uri = vscode.Uri.joinPath(this.extensionUri, 'bundled-manifest.json');
    const content = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(new TextDecoder().decode(content)) as BundledManifest;
  }

  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private toArtifactItem(entry: ManifestEntry, enabled: boolean): ArtifactItem {
    return {
      name: entry.name,
      type: entry.type,
      path: entry.relativePath,
      description: stripAttribution(entry.description),
      enabled,
      category: entry.category,
      agent: entry.agent,
      prompt: entry.prompt,
    };
  }
}

/** Removes trailing " - Brought to you by ..." attribution from descriptions. */
function stripAttribution(text: string): string {
  return text.replace(/\s*-\s*Brought to you by.*$/i, '');
}
