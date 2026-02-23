import * as vscode from 'vscode';
import { type TreeElement } from './models/types';
import { ArtifactTreeProvider } from './treeview/treeDataProvider';
import { openDetailPanel } from './webview/dashboardPanel';
import { openRunPanel } from './webview/runPanel';
import { openSettingsPanel, refreshSettingsPanel } from './webview/settingsPanel';
import { isInitialized, setInitialized, getFavorites, setFavorites, initFavorites, onFavoritesChanged } from './settings/configuration';
import { ArtifactManager } from './services/artifactManager';
import { WorkflowLoader } from './services/workflowLoader';
import { TrackingManager } from './services/trackingManager';
import { VIEW_ID, COMMANDS, CONFIG } from './constants';
import { QUICK_RUN_VIEW_ID, TRACKING_VIEW_ID, TRACKING_COMMANDS } from './constants';
import { QuickRunViewProvider } from './webview/quickRunPanel';
import { TrackingPanelProvider } from './webview/trackingPanel';
import { openTrackingDetailPanel } from './webview/trackingDetailPanel';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initFavorites(context.workspaceState);
  const manager = new ArtifactManager(context.extensionUri);
  const provider = new ArtifactTreeProvider();

  // Load artifacts from bundled manifest
  const artifacts = await manager.initialize();
  provider.setArtifacts(artifacts);

  // Quick Run sidebar panel
  const quickRunProvider = new QuickRunViewProvider(context);
  quickRunProvider.setArtifacts(artifacts);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(QUICK_RUN_VIEW_ID, quickRunProvider),
  );

  // Tracking dashboard services
  const workflowLoader = new WorkflowLoader();
  await workflowLoader.initialize(context.extensionUri);

  const trackingManager = new TrackingManager(workflowLoader);
  await trackingManager.initialize();

  const trackingProvider = new TrackingPanelProvider(context, trackingManager, workflowLoader);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TRACKING_VIEW_ID, trackingProvider),
  );

  // First-activation: copy default artifacts to workspace
  if (!isInitialized() && vscode.workspace.workspaceFolders?.length) {
    await manager.enableDefaults();
    await setInitialized(true);
    const freshArtifacts = await manager.getArtifacts();
    provider.setArtifacts(freshArtifacts);
    quickRunProvider.setArtifacts(freshArtifacts);
  }

  // Refresh helper used by watcher and commands
  const refreshTree = async (): Promise<void> => {
    const updated = await manager.getArtifacts();
    provider.setArtifacts(updated);
    quickRunProvider.setArtifacts(updated);
  };

  // Watch workspace for external changes to managed artifact files
  if (vscode.workspace.workspaceFolders?.length) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.workspace.workspaceFolders[0],
        '.github/{agents,prompts,instructions}/*.md',
      ),
    );
    watcher.onDidCreate(() => refreshTree());
    watcher.onDidDelete(() => refreshTree());
    context.subscriptions.push(watcher);

    // Watch .copilot-tracking/ for changes
    const trackingWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.workspace.workspaceFolders[0],
        '.copilot-tracking/**',
      ),
    );
    let trackingDebounce: ReturnType<typeof setTimeout> | undefined;
    const debouncedTrackingRefresh = (): void => {
      if (trackingDebounce) clearTimeout(trackingDebounce);
      trackingDebounce = setTimeout(async () => {
        await trackingManager.refresh();
        trackingProvider.refresh();
      }, 300);
    };
    trackingWatcher.onDidCreate(() => debouncedTrackingRefresh());
    trackingWatcher.onDidDelete(() => debouncedTrackingRefresh());
    trackingWatcher.onDidChange(() => debouncedTrackingRefresh());
    context.subscriptions.push(trackingWatcher);
  }

  // Register tree view
  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Double-click detection state for tree item clicks
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  let lastClickedName: string | undefined;
  const DOUBLE_CLICK_MS = 300;

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.refresh, refreshTree),

    vscode.commands.registerCommand(COMMANDS.clickArtifact, (element: TreeElement) => {
      if (element.kind !== 'artifact') return;
      const isRunnable = element.item.type !== 'instruction' && element.item.enabled;

      if (clickTimer && lastClickedName === element.item.name) {
        // Double-click: open run panel for runnable artifacts
        clearTimeout(clickTimer);
        clickTimer = undefined;
        lastClickedName = undefined;
        if (isRunnable) {
          openRunPanel(context, element.item);
        }
      } else {
        // First click: track for double-click detection but take no action
        if (clickTimer) clearTimeout(clickTimer);
        lastClickedName = element.item.name;
        clickTimer = setTimeout(() => {
          clickTimer = undefined;
          lastClickedName = undefined;
        }, DOUBLE_CLICK_MS);
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

    vscode.commands.registerCommand(COMMANDS.addFavorite, async (element: TreeElement) => {
      if (element?.kind !== 'artifact' || element.item.type !== 'prompt') return;
      const favs = [...getFavorites()];
      if (!favs.includes(element.item.name)) {
        favs.push(element.item.name);
        await setFavorites(favs);
        await refreshSettingsPanel(manager);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.removeFavorite, async (element: TreeElement) => {
      if (element?.kind !== 'artifact' || element.item.type !== 'prompt') return;
      const favs = [...getFavorites()];
      const idx = favs.indexOf(element.item.name);
      if (idx >= 0) {
        favs.splice(idx, 1);
        await setFavorites(favs);
        await refreshSettingsPanel(manager);
      }
    }),

    vscode.commands.registerCommand(TRACKING_COMMANDS.refreshTracking, async () => {
      await trackingManager.refresh();
      trackingProvider.refresh();
    }),

    vscode.commands.registerCommand(TRACKING_COMMANDS.openTrackingDetail, (category: string, instance: string) => {
      openTrackingDetailPanel(context, trackingManager, workflowLoader, category, instance);
    }),
  );

  // Dynamic commands for favorited prompts
  let favoriteDisposables: vscode.Disposable[] = [];

  const registerFavoriteCommands = (): void => {
    for (const d of favoriteDisposables) d.dispose();
    favoriteDisposables = [];
    for (const name of getFavorites()) {
      const cmdId = `hveCore.runFavorite.${name}`;
      const query = `/${name} `;
      const d = vscode.commands.registerCommand(cmdId, () =>
        vscode.commands.executeCommand('workbench.action.chat.open', {
          query,
          isPartialQuery: true,
        }),
      );
      favoriteDisposables.push(d);
    }
  };

  registerFavoriteCommands();
  context.subscriptions.push({ dispose: () => favoriteDisposables.forEach((d) => d.dispose()) });

  // Re-register favorite commands and refresh tree when favorites change
  context.subscriptions.push(
    onFavoritesChanged(() => {
      registerFavoriteCommands();
      provider.refresh();
      quickRunProvider.refresh();
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


