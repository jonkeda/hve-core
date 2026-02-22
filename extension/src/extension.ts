import * as vscode from 'vscode';
import { type ArtifactType, type TreeElement } from './models/types';
import { ArtifactTreeProvider } from './treeview/treeDataProvider';
import { openDetailPanel } from './webview/dashboardPanel';
import { openRunPanel } from './webview/runPanel';
import { openSettingsPanel, refreshSettingsPanel } from './webview/settingsPanel';
import { isGroupByType, setGroupByType, isInitialized, setInitialized } from './settings/configuration';
import { ArtifactManager } from './services/artifactManager';
import { VIEW_ID, COMMANDS, CONFIG } from './constants';

const GITIGNORE_ENTRIES = [
  '.github/agents/hve-core/',
  '.github/prompts/hve-core/',
  '.github/instructions/hve-core/',
];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const manager = new ArtifactManager(context.extensionUri);
  const provider = new ArtifactTreeProvider();

  // Load artifacts from bundled manifest
  const artifacts = await manager.initialize();
  provider.setArtifacts(artifacts);

  // First-activation: copy all artifacts to workspace and offer gitignore update
  if (!isInitialized() && vscode.workspace.workspaceFolders?.length) {
    await manager.enableAll();
    await setInitialized(true);
    const freshArtifacts = await manager.getArtifacts();
    provider.setArtifacts(freshArtifacts);
    offerGitignoreUpdate();
  }

  // Refresh helper used by watcher and commands
  const refreshTree = async (): Promise<void> => {
    const updated = await manager.getArtifacts();
    provider.setArtifacts(updated);
  };

  // Watch workspace for external changes to managed artifact files
  if (vscode.workspace.workspaceFolders?.length) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.workspace.workspaceFolders[0],
        '.github/{agents,prompts,instructions}/hve-core/**/*.md',
      ),
    );
    watcher.onDidCreate(() => refreshTree());
    watcher.onDidDelete(() => refreshTree());
    context.subscriptions.push(watcher);
  }

  // Register tree view
  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.refresh, refreshTree),

    vscode.commands.registerCommand(COMMANDS.toggleGrouping, async () => {
      const current = isGroupByType();
      await setGroupByType(!current);
      provider.refresh();
    }),

    vscode.commands.registerCommand(COMMANDS.filterByType, async () => {
      const current = provider.getTypeFilter();
      const items: { label: string; type: ArtifactType | null }[] = [
        { label: 'All', type: null },
        { label: 'Agents', type: 'agent' },
        { label: 'Prompts', type: 'prompt' },
        { label: 'Instructions', type: 'instruction' },
      ];
      const picked = await vscode.window.showQuickPick(
        items.map((i) => ({
          label: i.label,
          description: i.type === current ? '(active)' : undefined,
          type: i.type,
        })),
        { placeHolder: 'Filter artifacts by type' },
      );
      if (picked) {
        provider.setTypeFilter((picked as { label: string; type: ArtifactType | null }).type);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.runArtifact, async (element: TreeElement) => {
      if (element.kind !== 'artifact' || element.item.type === 'instruction') return;
      if (!element.item.enabled) return;
      await openRunPanel(context, element.item);
    }),

    vscode.commands.registerCommand(COMMANDS.openDetail, (element: TreeElement) => {
      if (element.kind !== 'artifact') return;
      openDetailPanel(context, element.item);
    }),

    vscode.commands.registerCommand(COMMANDS.toggleArtifact, async (element: TreeElement) => {
      if (element.kind !== 'artifact') return;
      if (element.item.enabled) {
        await manager.disableArtifact(element.item.name, element.item.type);
      } else {
        await manager.enableArtifact(element.item.name, element.item.type);
      }
      await refreshTree();
      await refreshSettingsPanel(manager);
    }),

    vscode.commands.registerCommand(COMMANDS.openSettings, async () => {
      await openSettingsPanel(context, manager, refreshTree);
    }),

    vscode.commands.registerCommand(COMMANDS.enableAll, async () => {
      await manager.enableAll();
      await refreshTree();
      await refreshSettingsPanel(manager);
    }),

    vscode.commands.registerCommand(COMMANDS.disableAll, async () => {
      await manager.disableAll();
      await refreshTree();
      await refreshSettingsPanel(manager);
    }),
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG.section)) {
        provider.refresh();
      }
    }),
  );

  // Dispose the manager's event emitter
  context.subscriptions.push(manager.onDidChange(() => {}));
}

export function deactivate(): void {
  // Cleanup handled by disposables registered in context.subscriptions
}

/** Offers to add managed artifact directories to .gitignore. */
function offerGitignoreUpdate(): void {
  const action = 'Add to .gitignore';
  vscode.window
    .showInformationMessage(
      'HVE Core artifacts have been initialized. Add managed directories to .gitignore?',
      action,
      'No thanks',
    )
    .then(async (choice) => {
      if (choice !== action) return;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const gitignoreUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');
      let existing = '';
      try {
        const content = await vscode.workspace.fs.readFile(gitignoreUri);
        existing = new TextDecoder().decode(content);
      } catch {
        // .gitignore does not exist yet
      }

      const linesToAdd = GITIGNORE_ENTRIES.filter((entry) => !existing.includes(entry));
      if (linesToAdd.length === 0) return;

      const separator = existing.endsWith('\n') || existing === '' ? '' : '\n';
      const addition = `${separator}\n# HVE Core managed artifacts\n${linesToAdd.join('\n')}\n`;
      const updated = existing + addition;
      await vscode.workspace.fs.writeFile(gitignoreUri, new TextEncoder().encode(updated));
    });
}
