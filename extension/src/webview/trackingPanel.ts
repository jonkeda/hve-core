import * as vscode from 'vscode';
import { getNonce } from '../utils/paths';
import { escapeHtml, escapeAttr } from '../utils/html';
import { type TrackingManager } from '../services/trackingManager';
import { type WorkflowLoader } from '../services/workflowLoader';
import { type TrackingInstance, type AuxiliaryState, type PhaseState, type TrackingDocument } from '../models/trackingTypes';

export class TrackingPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly trackingManager: TrackingManager,
    private readonly workflowLoader: WorkflowLoader,
  ) {}

  /** Registers the webview and wires up message handling. */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._context.extensionUri,
        vscode.Uri.file(vscode.env.appRoot),
      ],
    };
    webviewView.webview.html = this.buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: {
      command: string;
      path?: string;
      category?: string;
      instance?: string;
      visible?: boolean;
    }) => {
      switch (message.command) {
        case 'openDocument': {
          if (message.path) {
            const uri = vscode.Uri.file(message.path);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: true });
          }
          break;
        }
        case 'openDetail': {
          if (message.category && message.instance) {
            await vscode.commands.executeCommand(
              'hveCore.openTrackingDetail',
              message.category,
              message.instance,
            );
          }
          break;
        }
        case 'toggleCategoryFilter': {
          if (message.category) {
            const key = 'trackingHiddenCategories';
            const hidden = new Set(
              this._context.workspaceState.get<string[]>(key, []),
            );
            if (message.visible) {
              hidden.delete(message.category);
            } else {
              hidden.add(message.category);
            }
            await this._context.workspaceState.update(key, [...hidden]);
          }
          break;
        }
      }
    });
  }

  /** Re-renders the entire webview content. */
  refresh(): void {
    if (!this.view) return;
    this.view.webview.html = this.buildHtml(this.view.webview);
  }

  /** Returns categories hidden by the user's filter selection. */
  private getHiddenCategories(): Set<string> {
    return new Set(
      this._context.workspaceState.get<string[]>('trackingHiddenCategories', []),
    );
  }

  private buildFilterBarHtml(): string {
    const configs = this.workflowLoader.getAllConfigs();
    const hidden = this.getHiddenCategories();
    const buttons: string[] = [];

    for (const config of configs) {
      const instances = this.trackingManager.getInstances(config.category);
      if (instances.length === 0) continue;

      const category = escapeAttr(config.category);
      const icon = escapeAttr(config.icon);
      const displayName = escapeHtml(config.displayName);
      const inactiveClass = hidden.has(config.category) ? ' filter-inactive' : '';

      buttons.push(
        `<button class="filter-btn${inactiveClass}" data-category="${category}" title="Toggle ${displayName}">
  <span class="codicon ${icon}"></span> ${displayName}
</button>`,
      );
    }

    if (buttons.length === 0) return '';

    return `<div class="filter-bar">${buttons.join('\n')}</div>`;
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const codiconFontUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        vscode.Uri.file(vscode.env.appRoot),
        'out', 'vs', 'base', 'browser', 'ui', 'codicons', 'codicon', 'codicon.ttf',
      ),
    );
    const filterBarHtml = this.buildFilterBarHtml();
    const treeHtml = this.buildTreeHtml();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    @font-face {
      font-family: "codicon";
      font-display: block;
      src: url("${codiconFontUri}") format("truetype");
    }
    .codicon {
      font: normal normal normal 16px/1 codicon;
      display: inline-block;
      text-decoration: none;
      text-rendering: auto;
      text-align: center;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      user-select: none;
    }
    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    .tree-category { margin-bottom: 4px; }
    .tree-category > summary {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      cursor: pointer;
      font-weight: 600;
      color: var(--vscode-sideBarSectionHeader-foreground);
      background: var(--vscode-sideBarSectionHeader-background);
    }
    .tree-children { padding-left: 12px; }
    .tree-instance > summary,
    .tree-phase > summary {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      cursor: pointer;
    }
    .tree-instance > summary:hover,
    .tree-phase > summary:hover,
    .tree-doc:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .tree-doc {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px 2px 20px;
      cursor: pointer;
    }
    .badge {
      margin-left: auto;
      padding: 0 6px;
      border-radius: 10px;
      font-size: 0.85em;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status-dot.active { background: var(--vscode-testing-iconQueued); }
    .status-dot.paused { background: var(--vscode-disabledForeground); }
    .status-dot.archived { background: var(--vscode-disabledForeground); }
    .phase-chip {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 6px;
      border-radius: 3px;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-focusBorder);
    }
    .tree-phase.complete > summary .codicon { color: var(--vscode-testing-iconPassed); }
    .tree-phase.empty > summary { color: var(--vscode-disabledForeground); }
    .empty-msg {
      padding: 16px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 6px 8px;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-background);
    }
    .filter-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 12px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      font-family: var(--vscode-font-family);
      font-size: 0.85em;
      cursor: pointer;
    }
    .filter-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .filter-btn.filter-inactive {
      opacity: 0.5;
      background: transparent;
      border-style: dashed;
    }
    .category-hidden {
      display: none !important;
    }
    summary { list-style: none; }
    summary::-webkit-details-marker { display: none; }
    details > summary::before {
      content: '\\eb6f';
      font-family: codicon;
      margin-right: 4px;
      font-size: 12px;
      transition: transform 0.15s;
    }
    details[open] > summary::before {
      transform: rotate(90deg);
    }
  </style>
</head>
<body>
  ${filterBarHtml}
  ${treeHtml}
  <script nonce="${nonce}">
    (function() {
      var vscode = acquireVsCodeApi();

      document.addEventListener('click', function(e) {
        var docEl = e.target.closest('.tree-doc');
        if (docEl) {
          vscode.postMessage({ command: 'openDocument', path: docEl.dataset.path });
          return;
        }
      });

      document.addEventListener('dblclick', function(e) {
        var instanceSummary = e.target.closest('.tree-instance > summary');
        if (instanceSummary) {
          var instanceEl = instanceSummary.parentElement;
          vscode.postMessage({
            command: 'openDetail',
            category: instanceEl.dataset.category,
            instance: instanceEl.dataset.instance,
          });
        }
      });

      document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var cat = btn.dataset.category;
          var isNowInactive = btn.classList.toggle('filter-inactive');
          var catEl = document.querySelector('.tree-category[data-category="' + cat + '"');
          if (catEl) {
            catEl.classList.toggle('category-hidden', isNowInactive);
          }
          vscode.postMessage({
            command: 'toggleCategoryFilter',
            category: cat,
            visible: !isNowInactive,
          });
        });
      });

      document.querySelectorAll('.tree-category[data-hidden]').forEach(function(el) {
        el.classList.add('category-hidden');
      });
    })();
  </script>
</body>
</html>`;
  }

  private buildTreeHtml(): string {
    const configs = this.workflowLoader.getAllConfigs();
    const allInstances = this.trackingManager.getInstances();

    if (allInstances.length === 0) {
      return `<div class="empty-msg">
  <span class="codicon codicon-info"></span>
  <p>No tracking instances found.</p>
  <p>Create a .copilot-tracking folder with task instances to get started.</p>
</div>`;
    }

    const parts: string[] = [];

    for (const config of configs) {
      const instances = this.trackingManager.getInstances(config.category);
      if (instances.length === 0) continue;

      const hidden = this.getHiddenCategories();
      const hiddenAttr = hidden.has(config.category) ? ' data-hidden' : '';
      const categoryHtml = escapeAttr(config.category);
      const iconHtml = escapeAttr(config.icon);
      const displayNameHtml = escapeHtml(config.displayName);
      const countHtml = escapeHtml(String(instances.length));

      const instanceParts: string[] = [];
      for (const instance of instances) {
        instanceParts.push(this.buildInstanceHtml(instance));
      }

      parts.push(
        `<details class="tree-category" data-category="${categoryHtml}"${hiddenAttr} open>
  <summary>
    <span class="codicon ${iconHtml}"></span>
    <span class="label">${displayNameHtml}</span>
    <span class="badge">${countHtml}</span>
  </summary>
  <div class="tree-children">
    ${instanceParts.join('\n    ')}
  </div>
</details>`,
      );
    }

    return parts.join('\n');
  }

  private buildInstanceHtml(instance: TrackingInstance): string {
    const category = escapeAttr(instance.category);
    const instanceId = escapeAttr(`${instance.number}_${instance.name}`);
    const lifecycle = escapeAttr(instance.lifecycle);
    const label = escapeHtml(`${instance.number} — ${instance.name}`);

    const activePhase = instance.phases.find((p) => p.id === instance.activePhase);
    const activePhaseIcon = activePhase ? escapeAttr(activePhase.icon) : '';
    const activePhaseLabel = activePhase ? escapeHtml(activePhase.label) : '';

    const phaseParts: string[] = [];
    for (const phase of instance.phases) {
      phaseParts.push(this.buildPhaseHtml(phase));
    }
    for (const aux of instance.auxiliaryFolders) {
      if (aux.documents.length > 0) {
        phaseParts.push(this.buildAuxiliaryHtml(aux));
      }
    }

    return `<details class="tree-instance" data-category="${category}" data-instance="${instanceId}">
  <summary>
    <span class="status-dot ${lifecycle}"></span>
    <span class="label">${label}</span>
    <span class="phase-chip">
      <span class="codicon ${activePhaseIcon}"></span> ${activePhaseLabel}
    </span>
  </summary>
  <div class="tree-children">
    ${phaseParts.join('\n    ')}
  </div>
</details>`;
  }

  private buildPhaseHtml(phase: PhaseState): string {
    const status = escapeAttr(phase.status);
    const phaseId = escapeAttr(phase.id);
    const icon = escapeAttr(phase.icon);
    const label = escapeHtml(phase.label);
    const docCount = escapeHtml(String(phase.documents.length));

    const docParts: string[] = [];
    for (const doc of phase.documents) {
      docParts.push(this.buildDocumentHtml(doc));
    }

    return `<details class="tree-phase ${status}" data-phase="${phaseId}">
  <summary>
    <span class="codicon ${icon}"></span>
    <span class="label">${label}</span>
    <span class="badge">${docCount}</span>
  </summary>
  <div class="tree-children">
    ${docParts.join('\n    ')}
  </div>
</details>`;
  }

  private buildAuxiliaryHtml(aux: AuxiliaryState): string {
    const auxId = escapeAttr(aux.id);
    const label = escapeHtml(aux.label);
    const docCount = escapeHtml(String(aux.documents.length));

    const docParts: string[] = [];
    for (const doc of aux.documents) {
      docParts.push(this.buildDocumentHtml(doc));
    }

    return `<details class="tree-phase auxiliary" data-phase="${auxId}">
  <summary>
    <span class="codicon codicon-folder-library"></span>
    <span class="label">${label}</span>
    <span class="badge">${docCount}</span>
  </summary>
  <div class="tree-children">
    ${docParts.join('\n    ')}
  </div>
</details>`;
  }

  private buildDocumentHtml(doc: TrackingDocument): string {
    const path = escapeAttr(doc.path);
    const title = escapeHtml(doc.title);

    return `<div class="tree-doc" data-path="${path}">
  <span class="codicon codicon-file"></span>
  <span class="label">${title}</span>
</div>`;
  }
}
