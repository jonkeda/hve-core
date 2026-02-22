import * as vscode from 'vscode';
import { type ArtifactItem, type ArtifactType, inferDomain } from '../models/types';
import { type ArtifactManager } from '../services/artifactManager';
import { openDetailPanel } from './dashboardPanel';
import { getNonce } from '../utils/paths';

let activeSettingsPanel: vscode.WebviewPanel | undefined;

/** Maps agent names to their primary prompt when the relationship is not derivable by name. */
const AGENT_OVERRIDES: Record<string, string> = {
  'adr-creation': 'adr-create',
  'arch-diagram-builder': 'arch-diagram',
  'brd-builder': 'brd-build',
  'doc-ops': 'doc-ops-update',
  'github-backlog-manager': 'github-discover-issues',
  'hve-core-installer': 'hve-core-install',
  'instruction-analyzer': 'instruction-files-from-source',
  'instruction-generator': 'instruction-files-from-source',
  'memory': 'checkpoint',
  'prd-builder': 'prd-build',
  'prompt-builder': 'prompt-build',
  'rpi-agent': 'rpi',
  'security-plan-creator': 'security-plan',
  'task-implementor': 'task-implement',
  'task-planner': 'task-plan',
  'task-researcher': 'task-research',
  'task-reviewer': 'task-review',
};

/** Maps instruction names to their primary prompt when suffix stripping fails. */
const INSTRUCTION_OVERRIDES: Record<string, string> = {
  'ado-wit-discovery-instructions': 'ado-get-my-work-items',
  'ado-wit-planning-instructions': 'ado-process-my-work-items-for-task-planning',
  'commit-message-instructions': 'git-commit-message',
  'community-interaction-instructions': 'github-add-issue',
  'github-backlog-discovery-instructions': 'github-discover-issues',
  'github-backlog-planning-instructions': 'github-sprint-plan',
  'github-backlog-triage-instructions': 'github-triage-issues',
  'github-backlog-update-instructions': 'github-execute-backlog',
  'prompt-builder-instructions': 'prompt-build',
};

interface ArtifactGroup {
  prompt: ArtifactItem;
  agents: ArtifactItem[];
  instructions: ArtifactItem[];
}

interface DomainSection {
  domain: string;
  groups: ArtifactGroup[];
  orphans: ArtifactItem[];
}

/** Opens the settings panel for managing artifact enabled/disabled state. */
export async function openSettingsPanel(
  context: vscode.ExtensionContext,
  manager: ArtifactManager,
  onDidToggle: () => Promise<void>,
): Promise<void> {
  if (activeSettingsPanel) {
    activeSettingsPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'hveCore.settings',
    'HVE Core Settings',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  activeSettingsPanel = panel;
  panel.onDidDispose(() => { activeSettingsPanel = undefined; });

  const artifacts = await manager.getArtifacts();
  panel.webview.html = buildSettingsHtml(artifacts);

  const refreshAndNotify = async (): Promise<void> => {
    const updated = await manager.getArtifacts();
    artifacts.length = 0;
    artifacts.push(...updated);
    panel.webview.postMessage({ command: 'update', artifacts: updated });
    await onDidToggle();
  };

  panel.webview.onDidReceiveMessage(async (msg: { command: string; name?: string; names?: string[] }) => {
    if (msg.command === 'toggle' && msg.name) {
      const current = artifacts.find((a) => a.name === msg.name);
      if (current?.enabled) {
        await manager.disableArtifact(msg.name);
      } else {
        await manager.enableArtifact(msg.name);
      }
      await refreshAndNotify();
    } else if (msg.command === 'enableNames' && msg.names) {
      for (const name of msg.names) {
        await manager.enableArtifact(name);
      }
      await refreshAndNotify();
    } else if (msg.command === 'disableNames' && msg.names) {
      for (const name of msg.names) {
        await manager.disableArtifact(name);
      }
      await refreshAndNotify();
    } else if (msg.command === 'openDetail' && msg.name) {
      const artifact = artifacts.find((a) => a.name === msg.name);
      if (artifact) {
        await openDetailPanel(context, artifact);
      }
    }
  }, undefined, context.subscriptions);
}

/** Refreshes the settings panel if it is open. */
export async function refreshSettingsPanel(manager: ArtifactManager): Promise<void> {
  if (!activeSettingsPanel) return;
  const updated = await manager.getArtifacts();
  activeSettingsPanel.webview.postMessage({ command: 'update', artifacts: updated });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function typeIcon(type: ArtifactType): string {
  switch (type) {
    case 'agent': return '\u{1F916}';
    case 'prompt': return '\u26A1';
    case 'instruction': return '\u{1F4D6}';
  }
}

/** Resolves an agent name to its parent prompt name. */
function resolveAgentToPrompt(agentName: string, promptNames: Set<string>): string | undefined {
  const override = AGENT_OVERRIDES[agentName];
  if (override && promptNames.has(override)) return override;
  if (promptNames.has(agentName)) return agentName;
  return undefined;
}

/** Resolves an instruction name to its parent prompt name. */
function resolveInstructionToPrompt(instrName: string, promptNames: Set<string>): string | undefined {
  const override = INSTRUCTION_OVERRIDES[instrName];
  if (override && promptNames.has(override)) return override;
  const stripped = instrName.replace(/-instructions$/, '');
  if (promptNames.has(stripped)) return stripped;
  return undefined;
}

/** Builds domain sections with prompt-centric artifact groups and orphans. */
function buildDomainSections(artifacts: ArtifactItem[]): DomainSection[] {
  const prompts = artifacts.filter((a) => a.type === 'prompt');
  const agents = artifacts.filter((a) => a.type === 'agent');
  const instructions = artifacts.filter((a) => a.type === 'instruction');
  const promptNames = new Set(prompts.map((p) => p.name));

  const childMap = new Map<string, { agents: ArtifactItem[]; instructions: ArtifactItem[] }>();
  for (const p of prompts) childMap.set(p.name, { agents: [], instructions: [] });

  const assignedAgents = new Set<string>();
  const assignedInstructions = new Set<string>();

  for (const agent of agents) {
    const target = resolveAgentToPrompt(agent.name, promptNames);
    if (target) {
      childMap.get(target)!.agents.push(agent);
      assignedAgents.add(agent.name);
    }
  }

  for (const instr of instructions) {
    const target = resolveInstructionToPrompt(instr.name, promptNames);
    if (target) {
      childMap.get(target)!.instructions.push(instr);
      assignedInstructions.add(instr.name);
    }
  }

  const groups: ArtifactGroup[] = prompts.map((p) => ({
    prompt: p,
    agents: childMap.get(p.name)!.agents.sort((a, b) => a.name.localeCompare(b.name)),
    instructions: childMap.get(p.name)!.instructions.sort((a, b) => a.name.localeCompare(b.name)),
  }));

  const orphans = [
    ...agents.filter((a) => !assignedAgents.has(a.name)),
    ...instructions.filter((i) => !assignedInstructions.has(i.name)),
  ];

  const domainMap = new Map<string, { groups: ArtifactGroup[]; orphans: ArtifactItem[] }>();

  for (const g of groups) {
    const domain = inferDomain(g.prompt.name);
    if (!domainMap.has(domain)) domainMap.set(domain, { groups: [], orphans: [] });
    domainMap.get(domain)!.groups.push(g);
  }

  for (const o of orphans) {
    const domain = inferDomain(o.name);
    if (!domainMap.has(domain)) domainMap.set(domain, { groups: [], orphans: [] });
    domainMap.get(domain)!.orphans.push(o);
  }

  return [...domainMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, data]) => ({
      domain,
      groups: data.groups.sort((a, b) => a.prompt.name.localeCompare(b.prompt.name)),
      orphans: data.orphans.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/** Collects all artifact items in a domain section for counting. */
function collectDomainItems(section: DomainSection): ArtifactItem[] {
  const items: ArtifactItem[] = [];
  for (const g of section.groups) {
    items.push(g.prompt, ...g.agents, ...g.instructions);
  }
  items.push(...section.orphans);
  return items;
}

/** Renders a single artifact row (used for child items and orphans). */
function renderChildRow(item: ArtifactItem, domain: string): string {
  return `<div class="child-row">
                <span class="type-badge">${typeIcon(item.type)}</span>
                <input type="checkbox" data-name="${escapeHtml(item.name)}" data-domain="${escapeHtml(domain)}" ${item.enabled ? 'checked' : ''} />
                <span class="artifact-name">${escapeHtml(item.name)}</span>
                <button class="open-btn" data-open="${escapeHtml(item.name)}" title="View details">\u{1F4C4}</button>
              </div>`;
}

function buildSettingsHtml(artifacts: ArtifactItem[]): string {
  const nonce = getNonce();
  const sections = buildDomainSections(artifacts);

  const domainHtml = sections.map((section) => {
    const allItems = collectDomainItems(section);
    const enabledCount = allItems.filter((a) => a.enabled).length;

    const groupsHtml = section.groups.map((g) => {
      const hasChildren = g.agents.length > 0 || g.instructions.length > 0;
      const childrenHtml = [...g.agents, ...g.instructions]
        .map((child) => renderChildRow(child, section.domain))
        .join('');

      const bodyHtml = `
            <div class="prompt-body">
              <div class="prompt-desc">${escapeHtml(g.prompt.description)}</div>${childrenHtml}
            </div>`;

      return `
          <details class="prompt-group${hasChildren ? '' : ' prompt-leaf'}">
            <summary>
              <span class="type-badge">${typeIcon('prompt')}</span>
              <input type="checkbox" data-name="${escapeHtml(g.prompt.name)}" data-domain="${escapeHtml(section.domain)}" ${g.prompt.enabled ? 'checked' : ''} />
              <span class="artifact-name">${escapeHtml(g.prompt.name)}</span>
              <button class="open-btn" data-open="${escapeHtml(g.prompt.name)}" title="View details">\u{1F4C4}</button>
            </summary>${bodyHtml}
          </details>`;
    }).join('');

    const orphansHtml = section.orphans.length > 0
      ? `
        <div class="orphan-section">${section.orphans.map((o) => renderChildRow(o, section.domain)).join('')}
        </div>`
      : '';

    return `
      <details class="domain-group" data-domain-key="${escapeHtml(section.domain)}">
        <summary>
          <span class="domain-title">${escapeHtml(section.domain)}</span>
          <span class="domain-count" data-domain-count="${escapeHtml(section.domain)}">(${enabledCount}/${allItems.length})</span>
          <div class="domain-actions">
            <button class="link-btn" data-enable-domain="${escapeHtml(section.domain)}">Enable All</button>
            <button class="link-btn" data-disable-domain="${escapeHtml(section.domain)}">Disable All</button>
          </div>
        </summary>
        <div class="domain-content">${groupsHtml}${orphansHtml}
        </div>
      </details>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style nonce="${nonce}">
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 16px 20px;
      max-width: 700px;
      margin: 0 auto;
    }
    h1 {
      font-size: 1.3em;
      font-weight: 600;
      margin: 0 0 4px 0;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
      margin-bottom: 20px;
    }
    .domain-group {
      margin: 6px 0;
    }
    .domain-group > summary {
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 0.95em;
      font-weight: 600;
      user-select: none;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .domain-group > summary::-webkit-details-marker { display: none; }
    .domain-group > summary::before {
      content: '\\25b6';
      font-size: 0.7em;
      transition: transform 0.15s;
      display: inline-block;
    }
    .domain-group[open] > summary::before {
      transform: rotate(90deg);
    }
    .domain-group > summary:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .domain-title { flex: 1; }
    .domain-count {
      font-weight: 400;
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }
    .domain-actions {
      display: flex;
      gap: 4px;
    }
    .domain-content {
      padding-left: 8px;
    }
    .prompt-group {
      margin: 2px 0;
    }
    .prompt-group > summary {
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 0.9em;
      user-select: none;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .prompt-group > summary::-webkit-details-marker { display: none; }
    .prompt-group > summary::before {
      content: '\\25b6';
      font-size: 0.6em;
      transition: transform 0.15s;
      display: inline-block;
      color: var(--vscode-descriptionForeground);
    }
    .prompt-group[open] > summary::before {
      transform: rotate(90deg);
    }
    .prompt-group > summary:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .prompt-body {
      padding-left: 28px;
    }
    .prompt-desc {
      color: var(--vscode-descriptionForeground);
      font-size: 0.8em;
      line-height: 1.3;
      margin: 2px 0 4px 0;
    }
    .child-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 0.85em;
    }
    .child-row:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .orphan-section {
      margin-top: 4px;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,.2));
      padding-top: 4px;
    }
    .type-badge {
      font-size: 0.85em;
      flex-shrink: 0;
    }
    input[type="checkbox"] {
      flex-shrink: 0;
      accent-color: var(--vscode-textLink-foreground);
    }
    .artifact-name {
      font-size: 0.9em;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .open-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.85em;
      padding: 2px 4px;
      border-radius: 3px;
      opacity: 0.5;
      flex-shrink: 0;
    }
    .open-btn:hover {
      opacity: 1;
      background: var(--vscode-list-hoverBackground);
    }
    .link-btn {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      font-size: 0.78em;
      padding: 2px 4px;
    }
    .link-btn:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <h1>Manage Artifacts</h1>
  <div class="subtitle">Toggle artifacts on or off. Enabled artifacts appear in the tree view and are available in your workspace.</div>
  ${domainHtml}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    /* Prevent details toggle when clicking controls inside summary */
    document.querySelectorAll('details > summary').forEach(function(s) {
      s.addEventListener('click', function(e) {
        var t = e.target;
        if (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.closest('button')) {
          e.preventDefault();
        }
      });
    });

    /* Checkbox toggle — prompt checkboxes cascade to children */
    document.querySelectorAll('input[type="checkbox"][data-name]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var group = cb.closest('.prompt-group');
        var isSummaryCheckbox = group && cb.closest('summary');
        if (isSummaryCheckbox) {
          var allInGroup = Array.from(group.querySelectorAll('input[type="checkbox"][data-name]')).map(function(c) { return c.dataset.name; });
          var cmd = cb.checked ? 'enableNames' : 'disableNames';
          vscode.postMessage({ command: cmd, names: allInGroup });
        } else {
          vscode.postMessage({ command: 'toggle', name: cb.dataset.name });
        }
      });
    });

    /* Enable All domain */
    document.querySelectorAll('[data-enable-domain]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var domain = btn.dataset.enableDomain;
        var names = Array.from(document.querySelectorAll('input[data-domain="' + domain + '"]')).map(function(c) { return c.dataset.name; });
        vscode.postMessage({ command: 'enableNames', names: names });
      });
    });

    /* Disable All domain */
    document.querySelectorAll('[data-disable-domain]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var domain = btn.dataset.disableDomain;
        var names = Array.from(document.querySelectorAll('input[data-domain="' + domain + '"]')).map(function(c) { return c.dataset.name; });
        vscode.postMessage({ command: 'disableNames', names: names });
      });
    });

    /* Open detail button */
    document.querySelectorAll('[data-open]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'openDetail', name: btn.dataset.open });
      });
    });

    /* Update handler */
    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (msg.command === 'update') {
        var artifacts = msg.artifacts;
        document.querySelectorAll('input[type="checkbox"][data-name]').forEach(function(cb) {
          var a = artifacts.find(function(x) { return x.name === cb.dataset.name; });
          if (a) cb.checked = a.enabled;
        });
        var counts = {};
        document.querySelectorAll('input[type="checkbox"][data-domain]').forEach(function(cb) {
          var d = cb.dataset.domain;
          if (!counts[d]) counts[d] = { total: 0, enabled: 0 };
          counts[d].total++;
          if (cb.checked) counts[d].enabled++;
        });
        document.querySelectorAll('[data-domain-count]').forEach(function(el) {
          var d = el.dataset.domainCount;
          if (counts[d]) el.textContent = '(' + counts[d].enabled + '/' + counts[d].total + ')';
        });
      }
    });
  </script>
</body>
</html>`;
}
