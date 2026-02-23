import * as vscode from 'vscode';
import { getNonce } from '../utils/paths';
import { escapeHtml, escapeAttr } from '../utils/html';
import { type TrackingManager } from '../services/trackingManager';
import { type WorkflowLoader } from '../services/workflowLoader';
import { type TrackingInstance, type PhaseState, type WorkflowConfig } from '../models/trackingTypes';

const activePanels = new Map<string, vscode.WebviewPanel>();

/** Opens or reveals a detail panel for a tracking instance. */
export function openTrackingDetailPanel(
  context: vscode.ExtensionContext,
  trackingManager: TrackingManager,
  workflowLoader: WorkflowLoader,
  category: string,
  instanceName: string,
): void {
  const key = `${category}/${instanceName}`;
  const existing = activePanels.get(key);
  if (existing) {
    existing.reveal(vscode.ViewColumn.One);
    return;
  }

  const instance = trackingManager.getInstance(category, instanceName);
  if (!instance) return;

  const config = workflowLoader.getConfig(category);

  const panel = vscode.window.createWebviewPanel(
    'hveCore.trackingDetail',
    `${instance.number} — ${instance.name}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots: [
        context.extensionUri,
        vscode.Uri.file(vscode.env.appRoot),
      ],
    },
  );

  activePanels.set(key, panel);
  panel.onDidDispose(() => activePanels.delete(key));

  panel.webview.html = buildDetailHtml(panel.webview, context.extensionUri, instance, config);

  panel.webview.onDidReceiveMessage(async (message: {
    command: string;
    path?: string;
    query?: string;
    lifecycle?: string;
    instancePath?: string;
  }) => {
    switch (message.command) {
      case 'openDocument': {
        if (message.path) {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(message.path));
          await vscode.window.showTextDocument(doc, { preview: true });
        }
        break;
      }
      case 'resume': {
        if (message.query) {
          await vscode.commands.executeCommand('workbench.action.chat.open', {
            query: message.query,
            isPartialQuery: true,
          });
        }
        break;
      }
      case 'openFolder': {
        if (message.path) {
          await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(message.path));
        }
        break;
      }
      case 'setLifecycle': {
        if (message.lifecycle && message.instancePath) {
          const lifecycleUri = vscode.Uri.joinPath(vscode.Uri.file(message.instancePath), '.lifecycle');
          const content = `status: ${message.lifecycle}\nupdated: ${new Date().toISOString().slice(0, 10)}\n`;
          await vscode.workspace.fs.writeFile(lifecycleUri, new TextEncoder().encode(content));
        }
        break;
      }
    }
  });

  const disposable = trackingManager.onDidChange(() => {
    const updated = trackingManager.getInstance(category, instanceName);
    if (updated) {
      panel.webview.html = buildDetailHtml(panel.webview, context.extensionUri, updated, config);
    }
  });
  panel.onDidDispose(() => disposable.dispose());
}

function buildResumeOptions(
  instance: TrackingInstance,
  config: WorkflowConfig | undefined,
): { label: string; query: string }[] {
  if (!config) return [];
  const options: { label: string; query: string }[] = [];
  const activePhaseIndex = config.phases.findIndex((p) => p.id === instance.activePhase);
  const activePhaseDef = config.phases[activePhaseIndex];

  if (activePhaseDef?.prompt) {
    options.push({ label: `Continue: ${activePhaseDef.label}`, query: activePhaseDef.prompt });
  }

  if (activePhaseDef?.branches) {
    for (const branch of activePhaseDef.branches) {
      if (branch.prompt) {
        options.push({ label: `Branch: ${branch.label}`, query: branch.prompt });
      }
    }
  }

  for (let i = activePhaseIndex + 1; i < config.phases.length; i++) {
    const laterPhase = config.phases[i];
    if (laterPhase.feedbackTo?.includes(activePhaseDef?.id ?? '')) {
      if (laterPhase.prompt) {
        options.push({ label: `Feedback: ${laterPhase.label}`, query: laterPhase.prompt });
      }
    }
  }

  for (let i = 0; i < activePhaseIndex; i++) {
    const prevPhase = config.phases[i];
    if (prevPhase.prompt) {
      options.push({ label: `Back: ${prevPhase.label}`, query: prevPhase.prompt });
    }
  }

  return options;
}

function buildDetailHtml(
  webview: vscode.Webview,
  _extensionUri: vscode.Uri,
  instance: TrackingInstance,
  config: WorkflowConfig | undefined,
): string {
  const nonce = getNonce();
  const codiconFontUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      vscode.Uri.file(vscode.env.appRoot),
      'out', 'vs', 'base', 'browser', 'ui', 'codicons', 'codicon', 'codicon.ttf',
    ),
  );

  const totalDocs = instance.phases.reduce((sum, p) => sum + p.documents.length, 0);
  const activePhase = instance.phases.find((p) => p.id === instance.activePhase);
  const activePhaseLabel = activePhase ? escapeHtml(activePhase.label) : escapeHtml(instance.activePhase);

  const lifecycleStates = config?.lifecycleStates?.length
    ? config.lifecycleStates
    : ['active', 'paused', 'archived'];

  const lifecycleOptionsHtml = lifecycleStates
    .map((s) => {
      const selected = s === instance.lifecycle ? ' selected' : '';
      return `<option value="${escapeAttr(s)}"${selected}>${escapeHtml(s)}</option>`;
    })
    .join('\n      ');

  const stepperHtml = buildStepperHtml(instance.phases);
  const resumeOptions = buildResumeOptions(instance, config);
  const actionsHtml = resumeOptions.length > 0
    ? buildActionsHtml(resumeOptions)
    : '';
  const phaseSectionsHtml = buildPhaseSectionsHtml(instance, config);

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
      padding: 16px 24px;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      max-width: 900px;
      margin: 0 auto;
    }
    .header { margin-bottom: 24px; }
    .header h1 {
      margin: 0 0 8px;
      font-size: 1.4em;
      font-weight: 600;
    }
    .meta {
      display: flex;
      gap: 16px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .lifecycle-select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 4px 8px;
      border-radius: 4px;
    }
    .stepper {
      display: flex;
      align-items: flex-start;
      padding: 16px 0 24px;
      position: relative;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      position: relative;
    }
    .circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--vscode-disabledForeground);
      position: relative;
      z-index: 1;
      background: var(--vscode-editor-background);
    }
    .phase-complete .circle {
      border-color: var(--vscode-testing-iconPassed);
      background: var(--vscode-testing-iconPassed);
      color: var(--vscode-editor-background);
    }
    .phase-active .circle {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-focusBorder) 30%, transparent);
    }
    .phase-empty .circle {
      opacity: 0.5;
    }
    .step-label {
      margin-top: 6px;
      text-align: center;
      font-size: 0.85em;
    }
    .count {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
    .step-connector {
      position: absolute;
      top: 16px;
      left: calc(50% + 16px);
      right: calc(-50% + 16px);
      height: 2px;
      background: var(--vscode-disabledForeground);
      z-index: 0;
    }
    .phase-complete .step-connector {
      background: var(--vscode-testing-iconPassed);
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      align-items: center;
    }
    .resume-select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 4px 8px;
      border-radius: 4px;
      flex: 1;
      max-width: 400px;
    }
    .resume-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    .resume-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .phase-section {
      margin-bottom: 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    .phase-section > summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-weight: 500;
    }
    .phase-section > summary:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .open-folder-btn {
      margin-left: auto;
      background: transparent;
      color: var(--vscode-textLink-foreground);
      border: 1px solid var(--vscode-textLink-foreground);
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85em;
    }
    .doc-list { padding: 4px 12px 8px 32px; }
    .doc-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 3px;
    }
    .doc-item:hover { background: var(--vscode-list-hoverBackground); }
    .empty-phase {
      padding: 8px;
      color: var(--vscode-disabledForeground);
      font-style: italic;
    }
    summary { list-style: none; }
    summary::-webkit-details-marker { display: none; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(instance.number)} — ${escapeHtml(instance.name)}</h1>
    <div class="meta">
      <span>Category: ${escapeHtml(instance.category)}</span>
      <span>Active Phase: ${activePhaseLabel}</span>
      <span>${escapeHtml(String(totalDocs))} documents across ${escapeHtml(String(instance.phases.length))} phases</span>
    </div>
    <select class="lifecycle-select" id="lifecycle-select" data-instance-path="${escapeAttr(instance.path)}">
      ${lifecycleOptionsHtml}
    </select>
  </div>
  ${stepperHtml}
  ${actionsHtml}
  ${phaseSectionsHtml}
  <script nonce="${nonce}">
    (function() {
      var vscode = acquireVsCodeApi();

      document.addEventListener('click', function(e) {
        var docItem = e.target.closest('.doc-item');
        if (docItem) {
          vscode.postMessage({ command: 'openDocument', path: docItem.dataset.path });
          return;
        }
        var folderBtn = e.target.closest('.open-folder-btn');
        if (folderBtn) {
          e.preventDefault();
          e.stopPropagation();
          vscode.postMessage({ command: 'openFolder', path: folderBtn.dataset.path });
          return;
        }
      });

      document.getElementById('resume-btn')?.addEventListener('click', function() {
        var select = document.getElementById('resume-select');
        if (select && select.value) {
          vscode.postMessage({ command: 'resume', query: select.value });
        }
      });

      document.getElementById('lifecycle-select')?.addEventListener('change', function() {
        var value = this.value;
        vscode.postMessage({ command: 'setLifecycle', lifecycle: value, instancePath: this.dataset.instancePath });
      });
    })();
  </script>
</body>
</html>`;
}

function buildStepperHtml(phases: PhaseState[]): string {
  const parts: string[] = [];
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const connector = i < phases.length - 1
      ? '<div class="step-connector"></div>'
      : '';
    parts.push(
      `<div class="step phase-${escapeAttr(phase.status)}">
      ${connector}
      <div class="circle"><span class="codicon ${escapeAttr(phase.icon)}"></span></div>
      <div class="step-label">${escapeHtml(phase.label)}<br><span class="count">${escapeHtml(String(phase.documents.length))} docs</span></div>
    </div>`,
    );
  }
  return `<div class="stepper">\n    ${parts.join('\n    ')}\n  </div>`;
}

function buildActionsHtml(options: { label: string; query: string }[]): string {
  const optionsHtml = options
    .map((o) => `<option value="${escapeAttr(o.query)}">${escapeHtml(o.label)}</option>`)
    .join('\n        ');
  return `<div class="actions">
    <select class="resume-select" id="resume-select">
      ${optionsHtml}
    </select>
    <button class="resume-btn" id="resume-btn">Resume</button>
  </div>`;
}

function buildPhaseSectionsHtml(
  instance: TrackingInstance,
  config: WorkflowConfig | undefined,
): string {
  const parts: string[] = [];
  for (const phase of instance.phases) {
    const openAttr = phase.status === 'active' ? ' open' : '';
    const phaseDef = config?.phases.find((d) => d.id === phase.id);
    const folderPath = phaseDef
      ? `${instance.path}/${phaseDef.folder}`
      : instance.path;

    const docItems = phase.documents.length > 0
      ? phase.documents
          .map((doc) =>
            `<div class="doc-item" data-path="${escapeAttr(doc.path)}">
          <span class="codicon codicon-file"></span>
          ${escapeHtml(doc.title)}
        </div>`,
          )
          .join('\n      ')
      : '<div class="empty-phase">No documents</div>';

    parts.push(
      `<details class="phase-section"${openAttr}>
    <summary>
      <span class="codicon ${escapeAttr(phase.icon)}"></span>
      ${escapeHtml(phase.label)} (${escapeHtml(String(phase.documents.length))} documents)
      <button class="open-folder-btn" data-path="${escapeAttr(folderPath)}">Open Folder</button>
    </summary>
    <div class="doc-list">
      ${docItems}
    </div>
  </details>`,
    );
  }
  return parts.join('\n  ');
}
