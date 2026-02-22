import * as vscode from 'vscode';
import { type ArtifactItem, type ArtifactType, inferDomain } from '../models/types';
import { type ArtifactManager } from '../services/artifactManager';
import { openDetailPanel } from './dashboardPanel';
import { getFavorites, setFavorites } from '../settings/configuration';
import { getNonce } from '../utils/paths';

let activeSettingsPanel: vscode.WebviewPanel | undefined;

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
  panel.webview.html = buildSettingsHtml(artifacts, getFavorites());

  const refreshAndNotify = async (): Promise<void> => {
    const updated = await manager.getArtifacts();
    artifacts.length = 0;
    artifacts.push(...updated);
    panel.webview.postMessage({ command: 'update', artifacts: updated, favorites: getFavorites() });
    await onDidToggle();
  };

  panel.webview.onDidReceiveMessage(async (msg: { command: string; name?: string; type?: string; items?: { name: string; type: string }[] }) => {
    if (msg.command === 'toggle' && msg.name && msg.type) {
      const current = artifacts.find((a) => a.name === msg.name && a.type === msg.type);
      if (current?.enabled) {
        await manager.disableArtifact(msg.name, msg.type as ArtifactType);
      } else {
        await manager.enableArtifact(msg.name, msg.type as ArtifactType);
      }
      await refreshAndNotify();
    } else if (msg.command === 'enableItems' && msg.items) {
      for (const item of msg.items) {
        await manager.enableArtifact(item.name, item.type as ArtifactType);
      }
      await refreshAndNotify();
    } else if (msg.command === 'disableItems' && msg.items) {
      for (const item of msg.items) {
        await manager.disableArtifact(item.name, item.type as ArtifactType);
      }
      await refreshAndNotify();
    } else if (msg.command === 'openDetail' && msg.name) {
      const artifact = artifacts.find((a) => a.name === msg.name && (!msg.type || a.type === msg.type));
      if (artifact) {
        await openDetailPanel(context, artifact);
      }
    } else if (msg.command === 'toggleFavorite' && msg.name) {
      const favs = [...getFavorites()];
      const idx = favs.indexOf(msg.name);
      if (idx >= 0) {
        favs.splice(idx, 1);
      } else {
        favs.push(msg.name);
      }
      await setFavorites(favs);
      panel.webview.postMessage({ command: 'updateFavorites', favorites: favs });
    }
  }, undefined, context.subscriptions);
}

/** Refreshes the settings panel if it is open. */
export async function refreshSettingsPanel(manager: ArtifactManager): Promise<void> {
  if (!activeSettingsPanel) return;
  const updated = await manager.getArtifacts();
  activeSettingsPanel.webview.postMessage({ command: 'update', artifacts: updated, favorites: getFavorites() });
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

/** Resolves an agent name to its parent prompt name using the prompt agent field. */
function resolveAgentToPrompt(agentName: string, promptNames: Set<string>, agentToPrompt: Map<string, string>): string | undefined {
  const mapped = agentToPrompt.get(agentName);
  if (mapped && promptNames.has(mapped)) return mapped;
  if (promptNames.has(agentName)) return agentName;
  return undefined;
}

/** Resolves an instruction name to its parent prompt name using the prompt field. */
function resolveInstructionToPrompt(instrName: string, promptNames: Set<string>, instrToPrompt: Map<string, string>): string | undefined {
  const mapped = instrToPrompt.get(instrName);
  if (mapped && promptNames.has(mapped)) return mapped;
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

  // Build agentName→promptName map from prompt agent fields
  const agentToPrompt = new Map<string, string>();
  for (const p of prompts) {
    if (p.agent) agentToPrompt.set(p.agent, p.name);
  }

  // Build instrName→promptName map from instruction prompt fields
  const instrToPrompt = new Map<string, string>();
  for (const i of instructions) {
    if (i.prompt) instrToPrompt.set(i.name, i.prompt);
  }

  const assignedAgents = new Set<string>();
  const assignedInstructions = new Set<string>();

  for (const agent of agents) {
    const target = resolveAgentToPrompt(agent.name, promptNames, agentToPrompt);
    if (target) {
      childMap.get(target)!.agents.push(agent);
      assignedAgents.add(agent.name);
    }
  }

  for (const instr of instructions) {
    const target = resolveInstructionToPrompt(instr.name, promptNames, instrToPrompt);
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
    const domain = g.prompt.category ?? inferDomain(g.prompt.name);
    if (!domainMap.has(domain)) domainMap.set(domain, { groups: [], orphans: [] });
    domainMap.get(domain)!.groups.push(g);
  }

  for (const o of orphans) {
    const domain = o.category ?? inferDomain(o.name);
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
                <input type="checkbox" data-name="${escapeHtml(item.name)}" data-type="${item.type}" data-domain="${escapeHtml(domain)}" ${item.enabled ? 'checked' : ''} />
                <span class="artifact-name">${escapeHtml(item.name)}</span>
                <button class="open-btn" data-open="${escapeHtml(item.name)}" data-open-type="${item.type}" title="View details">\u{1F4C4}</button>
              </div>`;
}

function buildSettingsHtml(artifacts: ArtifactItem[], favorites: string[]): string {
  const nonce = getNonce();
  const favSet = new Set(favorites);
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
              <input type="checkbox" data-name="${escapeHtml(g.prompt.name)}" data-type="prompt" data-domain="${escapeHtml(section.domain)}" ${g.prompt.enabled ? 'checked' : ''} />
              <span class="artifact-name">${escapeHtml(g.prompt.name)}</span>
              <button class="open-btn" data-open="${escapeHtml(g.prompt.name)}" data-open-type="prompt" title="View details">\u{1F4C4}</button>
              <button type="button" class="fav-btn" data-fav="${escapeHtml(g.prompt.name)}" title="Toggle favorite">${favSet.has(g.prompt.name) ? '\u2605' : '\u2606'}</button>
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
    .fav-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.95em;
      padding: 2px 4px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .fav-btn:hover {
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

    /* Favorite toggle — must be registered before generic stopPropagation */
    document.querySelectorAll('[data-fav]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        vscode.postMessage({ command: 'toggleFavorite', name: btn.dataset.fav });
      });
    });

    /* Stop propagation from controls inside summary so details does not toggle */
    document.querySelectorAll('details > summary input, details > summary button:not(.fav-btn)').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    });

    /* Checkbox toggle — prompt checkboxes cascade to children */
    document.querySelectorAll('input[type="checkbox"][data-name]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var group = cb.closest('.prompt-group');
        var isSummaryCheckbox = group && cb.closest('summary');
        if (isSummaryCheckbox) {
          var allInGroup = Array.from(group.querySelectorAll('input[type="checkbox"][data-name]')).map(function(c) { return { name: c.dataset.name, type: c.dataset.type }; });
          var cmd = cb.checked ? 'enableItems' : 'disableItems';
          vscode.postMessage({ command: cmd, items: allInGroup });
        } else {
          vscode.postMessage({ command: 'toggle', name: cb.dataset.name, type: cb.dataset.type });
        }
      });
    });

    /* Enable All domain */
    document.querySelectorAll('[data-enable-domain]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var domain = btn.dataset.enableDomain;
        var items = Array.from(document.querySelectorAll('input[data-domain="' + domain + '"]')).map(function(c) { return { name: c.dataset.name, type: c.dataset.type }; });
        vscode.postMessage({ command: 'enableItems', items: items });
      });
    });

    /* Disable All domain */
    document.querySelectorAll('[data-disable-domain]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var domain = btn.dataset.disableDomain;
        var items = Array.from(document.querySelectorAll('input[data-domain="' + domain + '"]')).map(function(c) { return { name: c.dataset.name, type: c.dataset.type }; });
        vscode.postMessage({ command: 'disableItems', items: items });
      });
    });

    /* Open detail button */
    document.querySelectorAll('[data-open]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'openDetail', name: btn.dataset.open, type: btn.dataset.openType });
      });
    });

    /* Update handler */
    function updateStars(favorites) {
      document.querySelectorAll('[data-fav]').forEach(function(btn) {
        btn.textContent = favorites.indexOf(btn.dataset.fav) >= 0 ? '\u2605' : '\u2606';
      });
    }

    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (msg.command === 'update') {
        var artifacts = msg.artifacts;
        document.querySelectorAll('input[type="checkbox"][data-name]').forEach(function(cb) {
          var a = artifacts.find(function(x) { return x.name === cb.dataset.name && x.type === cb.dataset.type; });
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
        if (msg.favorites) updateStars(msg.favorites);
      }
      if (msg.command === 'updateFavorites' && msg.favorites) {
        updateStars(msg.favorites);
      }
    });
  </script>
</body>
</html>`;
}
