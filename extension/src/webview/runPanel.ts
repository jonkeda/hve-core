import * as vscode from 'vscode';
import { tmpdir } from 'os';
import { join } from 'path';
import { type ArtifactItem } from '../models/types';
import { resolveArtifactUri, getNonce } from '../utils/paths';

/** Tracks active run panels to prevent duplicates. */
const activeRunPanels = new Map<string, vscode.WebviewPanel>();

/** A selectable choice for a multiple-choice parameter. */
interface PromptChoice {
  value: string;
  label: string;
}

/** Input parameter extracted from prompt ${input:...} variables. */
interface PromptParam {
  name: string;
  defaultValue: string;
  description: string;
  choices: PromptChoice[];
  isBoolean: boolean;
}

/** Opens a parameter input panel for the given artifact before running it in chat. */
export async function openRunPanel(
  context: vscode.ExtensionContext,
  artifact: ArtifactItem,
): Promise<void> {
  const existing = activeRunPanels.get(artifact.name);
  if (existing) {
    existing.reveal(vscode.ViewColumn.One);
    return;
  }

  const params = await extractParams(context.extensionUri, artifact);

  // No parameters found — run directly in chat
  if (params.length === 0) {
    const query = artifact.type === 'agent' ? `@${artifact.name} ` : `/${artifact.name} `;
    await vscode.commands.executeCommand('workbench.action.chat.open', { query });
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'hveCore.runArtifact',
    `Run: ${artifact.name}`,
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: false },
  );

  activeRunPanels.set(artifact.name, panel);
  panel.onDidDispose(() => activeRunPanels.delete(artifact.name));

  panel.webview.onDidReceiveMessage(async (message: { command: string; query?: string; attachFiles?: string[] }) => {
    switch (message.command) {
      case 'run': {
        if (!message.query) break;
        const opts: Record<string, unknown> = { query: message.query };
        if (message.attachFiles?.length) {
          opts.attachFiles = message.attachFiles.map(f => vscode.Uri.parse(f));
        }
        await vscode.commands.executeCommand('workbench.action.chat.open', opts);
        panel.dispose();
        break;
      }
      case 'pasteImage': {
        const msg = message as { command: string; data?: string; mimeType?: string };
        if (msg.data) {
          const ext = msg.mimeType === 'image/jpeg' ? '.jpg'
            : msg.mimeType === 'image/gif' ? '.gif'
            : msg.mimeType === 'image/webp' ? '.webp'
            : '.png';
          const fileName = `pasted-${Date.now()}${ext}`;
          const filePath = join(tmpdir(), fileName);
          const fileUri = vscode.Uri.file(filePath);
          const buffer = Buffer.from(msg.data, 'base64');
          await vscode.workspace.fs.writeFile(fileUri, buffer);
          await panel.webview.postMessage({
            command: 'filesSelected',
            paths: [{ uri: fileUri.toString(), name: fileName, kind: 'image' }],
          });
        }
        break;
      }
      case 'pickFiles':
      case 'pickFolders':
      case 'pickImages': {
        const isFolder = message.command === 'pickFolders';
        const isImage = message.command === 'pickImages';
        const filters = isImage
          ? { Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }
          : undefined;
        const uris = await vscode.window.showOpenDialog({
          canSelectMany: true,
          canSelectFiles: !isFolder,
          canSelectFolders: isFolder,
          defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
          title: isFolder ? 'Select Context Folders' : isImage ? 'Select Images' : 'Select Context Files',
          filters,
        });
        if (uris?.length) {
          const paths = uris.map(u => ({
            uri: u.toString(),
            name: u.path.split('/').pop() ?? u.toString(),
            kind: isFolder ? 'folder' : isImage ? 'image' : 'file',
          }));
          await panel.webview.postMessage({ command: 'filesSelected', paths });
        }
        break;
      }
    }
  });

  panel.webview.html = buildRunHtml(panel.webview, artifact, params);
}

/** Extracts ${input:...} parameters from the artifact's markdown content. */
async function extractParams(
  extensionUri: vscode.Uri,
  artifact: ArtifactItem,
): Promise<PromptParam[]> {
  try {
    const fileUri = resolveArtifactUri(extensionUri, artifact.path);
    const content = await vscode.workspace.fs.readFile(fileUri);
    const text = new TextDecoder().decode(content);
    return parseInputVariables(text);
  } catch {
    return [];
  }
}

/** Parses ${input:name} and ${input:name:default} patterns with descriptions and sub-bullet choices. */
function parseInputVariables(text: string): PromptParam[] {
  const seen = new Set<string>();
  const params: PromptParam[] = [];
  const lines = text.split('\n');
  const inputLineRegex = /\$\{input:([^}:]+)(?::([^}]*))?\}/;

  for (let i = 0; i < lines.length; i++) {
    const match = inputLineRegex.exec(lines[i]);
    if (!match) continue;

    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);

    const defaultValue = match[2] ?? '';

    // Extract description: text after the closing } on the same line
    let description = '';
    const afterVar = lines[i].substring((match.index ?? 0) + match[0].length);
    const descMatch = afterVar.match(/^[:`]*\s*(.+)/);
    if (descMatch) {
      description = descMatch[1].replace(/^\s*[:–—-]\s*/, '').trim();
    }

    // Collect indented sub-bullets as choices
    const choices: PromptChoice[] = [];
    let j = i + 1;
    while (j < lines.length && /^\s+\*\s+/.test(lines[j])) {
      const bullet = lines[j].replace(/^\s+\*\s+/, '').trim();
      // Strip backticks from value portion
      const dashIdx = bullet.indexOf(' - ');
      if (dashIdx !== -1) {
        const value = bullet.substring(0, dashIdx).replace(/`/g, '').trim();
        const label = bullet.substring(dashIdx + 3).trim();
        choices.push({ value, label });
      } else {
        const value = bullet.replace(/`/g, '').trim();
        choices.push({ value, label: '' });
      }
      j++;
    }

    params.push({ name, defaultValue, description, choices, isBoolean: /^(true|false)$/i.test(defaultValue) });
  }

  return params;
}

/** Converts camelCase or kebab-case to Title Case: validateOnly → Validate Only */
function humanizeLabel(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parsed badge and cleaned description from a parameter description string. */
interface DescBadge {
  badge: 'required' | 'optional' | null;
  text: string;
}

/** Extracts (Required) or (Optional...) badge from description text. */
function parseDescBadge(description: string): DescBadge {
  const reqMatch = description.match(/^\(Required\)\s*/i);
  if (reqMatch) {
    return { badge: 'required', text: description.substring(reqMatch[0].length).trim() };
  }
  const optMatch = description.match(/^\(Optional[^)]*\)\s*/i);
  if (optMatch) {
    return { badge: 'optional', text: description.substring(optMatch[0].length).trim() };
  }
  return { badge: null, text: description };
}

/** Builds the webview HTML with parameter input fields and a Run button. */
function buildRunHtml(
  webview: vscode.Webview,
  artifact: ArtifactItem,
  params: PromptParam[],
): string {
  const nonce = getNonce();
  const prefix = artifact.type === 'agent' ? `@${artifact.name} ` : `/${artifact.name} `;

  const paramFields = params
    .map((p) => {
      const escaped = escapeHtml(p.name);
      const humanName = escapeHtml(humanizeLabel(p.name));
      const { badge, text: descText } = parseDescBadge(p.description);

      const badgeHtml = badge === 'required'
        ? ' <span class="required-star">*</span>'
        : '';
      const descHtml = descText
        ? `\n        <span class="desc">${escapeHtml(descText)}</span>`
        : '';

      if (p.choices.length > 0) {
        const radios = p.choices
          .map((c) => {
            const val = escapeAttr(c.value);
            const checked = c.value === p.defaultValue ? ' checked' : '';
            const choiceDesc = c.label
              ? `<span class="choice-desc">${escapeHtml(c.label)}</span>`
              : '';
            return `
            <label class="radio-label">
              <input type="radio" name="param-${escaped}" value="${val}"${checked} />
              <span class="choice-value">${escapeHtml(c.value)}</span>
              ${choiceDesc}
            </label>`;
          })
          .join('\n');
        return `
      <div class="field-card">
        <label>${humanName}${badgeHtml}</label>${descHtml}
        <div class="radio-group" data-param="${escaped}">
          ${radios}
        </div>
      </div>`;
      }

      if (p.isBoolean) {
        const checked = p.defaultValue.toLowerCase() === 'true' ? ' checked' : '';
        return `
      <div class="field-card">
        <label class="bool-label">
          <input type="checkbox" data-param="${escaped}" data-bool="true"${checked} />
          <span>${humanName}${badgeHtml}</span>
        </label>${descHtml}
      </div>`;
      }

      return `
      <div class="field-card">
        <label for="param-${escaped}">${humanName}${badgeHtml}</label>${descHtml}
        <textarea id="param-${escaped}" data-param="${escaped}"
                  placeholder="Enter ${escaped}..." rows="2">${escapeHtml(p.defaultValue)}</textarea>
      </div>`;
    })
    .join('\n');

  const typeLabel = artifact.type === 'agent' ? 'AGENT' : 'PROMPT';
  const typeBadgeClass = artifact.type === 'agent' ? 'type-agent' : 'type-prompt';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    body {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      padding: 24px;
      margin: 0;
      display: flex;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 600px;
    }

    /* Header */
    .header {
      margin-bottom: 8px;
    }
    .header-top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .header h2 {
      margin: 0;
      font-size: 1.4em;
      font-weight: 700;
    }
    .type-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.65em;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .type-agent {
      background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 20%, transparent);
      color: var(--vscode-charts-purple, #b180d7);
    }
    .type-prompt {
      background: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 20%, transparent);
      color: var(--vscode-charts-blue, #3794ff);
    }
    .header .subtitle {
      margin: 0;
      opacity: 0.7;
      line-height: 1.4;
    }
    .divider {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.35));
      margin: 16px 0;
    }

    /* Field cards */
    .field-card {
      padding: 10px 0;
      margin-bottom: 4px;
    }
    .field-card label {
      display: block;
      margin-bottom: 2px;
      font-weight: 600;
      font-size: 0.95em;
    }
    .required-star {
      color: var(--vscode-charts-red, #f14c4c);
      margin-left: 2px;
    }
    .desc {
      display: block;
      margin-bottom: 8px;
      opacity: 0.7;
      font-size: 0.88em;
      line-height: 1.4;
    }
    .field-card textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 7px 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.4));
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: inherit;
      resize: vertical;
      min-height: 2.4em;
    }
    .field-card textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    /* Radio groups */
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 6px;
      background: var(--vscode-editor-background);
      border-radius: 4px;
      padding: 6px 0;
    }
    .radio-label {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .radio-label:hover {
      background: color-mix(in srgb, var(--vscode-list-hoverBackground, rgba(128,128,128,0.1)) 60%, transparent);
    }
    .radio-label input[type="radio"] {
      accent-color: var(--vscode-focusBorder);
      flex-shrink: 0;
    }
    .bool-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .bool-label input[type="checkbox"] {
      accent-color: var(--vscode-focusBorder);
      flex-shrink: 0;
      width: 16px;
      height: 16px;
    }
    .choice-value {
      font-weight: 600;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
    }
    .choice-desc {
      opacity: 0.7;
      font-size: 0.88em;
    }

    /* Actions */
    .actions {
      margin-top: 20px;
    }
    .run-btn {
      width: 100%;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1em;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .run-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Context section */
    .context-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.35));
    }
    .context-label {
      font-weight: 600;
      font-size: 0.95em;
      margin-bottom: 8px;
      opacity: 0.8;
    }
    .context-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .ctx-btn {
      background: transparent;
      color: var(--vscode-editor-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.4));
      padding: 5px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.88em;
      font-family: var(--vscode-font-family);
      transition: background 0.1s;
    }
    .ctx-btn:hover {
      background: color-mix(in srgb, var(--vscode-list-hoverBackground, rgba(128,128,128,0.1)) 60%, transparent);
    }
    .chip-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: color-mix(in srgb, var(--vscode-badge-background, #616161) 30%, transparent);
      color: var(--vscode-editor-foreground);
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.82em;
      max-width: 220px;
    }
    .chip-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chip-remove {
      background: none;
      border: none;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
      padding: 0 2px;
      font-size: 1em;
      opacity: 0.7;
      line-height: 1;
    }
    .chip-remove:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <h2>${escapeHtml(artifact.name)}</h2>
        <span class="type-badge ${typeBadgeClass}">${typeLabel}</span>
      </div>
      <p class="subtitle">${escapeHtml(artifact.description)}</p>
    </div>
    <hr class="divider" />

    <form id="run-form">
      <div class="actions">
        <button class="run-btn" type="submit">&#9654; Run</button>
      </div>
      ${paramFields}
    </form>

    <div class="context-section">
      <div class="context-label">Context (optional)</div>
      <div class="context-buttons">
        <button type="button" class="ctx-btn" data-pick="pickFiles">&#128196; Files</button>
        <button type="button" class="ctx-btn" data-pick="pickFolders">&#128193; Folders</button>
        <button type="button" class="ctx-btn" data-pick="pickImages">&#128444;&#65039; Images</button>
        <button type="button" class="ctx-btn" id="paste-btn">&#128203; Paste</button>
      </div>
      <div class="chip-container" id="chip-container"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const prefix = ${JSON.stringify(prefix)};
      const selectedFiles = [];

      function esc(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      function renderChips() {
        const container = document.getElementById('chip-container');
        container.innerHTML = selectedFiles.map(function(f, i) {
          var icon = f.kind === 'folder' ? '\uD83D\uDCC1' : f.kind === 'image' ? '\uD83D\uDDBC\uFE0F' : '\uD83D\uDCC4';
          return '<span class="chip" title="' + esc(f.uri) + '">' +
            '<span class="chip-icon">' + icon + '</span>' +
            '<span class="chip-name">' + esc(f.name) + '</span>' +
            '<button type="button" class="chip-remove" data-idx="' + i + '">&times;</button>' +
            '</span>';
        }).join('');
      }

      document.getElementById('chip-container').addEventListener('click', function(e) {
        var btn = e.target.closest('.chip-remove');
        if (btn) {
          selectedFiles.splice(Number(btn.dataset.idx), 1);
          renderChips();
        }
      });

      document.querySelectorAll('.ctx-btn[data-pick]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          vscode.postMessage({ command: btn.dataset.pick });
        });
      });

      document.getElementById('paste-btn').addEventListener('click', async function() {
        try {
          var items = await navigator.clipboard.read();
          for (var item of items) {
            var imageType = item.types.find(function(t) { return t.startsWith('image/'); });
            if (imageType) {
              var blob = await item.getType(imageType);
              var reader = new FileReader();
              reader.onloadend = function() {
                var base64 = reader.result.split(',')[1];
                vscode.postMessage({ command: 'pasteImage', data: base64, mimeType: imageType });
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        } catch (_e) { /* clipboard not available or empty */ }
      });

      window.addEventListener('message', function(event) {
        var msg = event.data;
        if (msg.command === 'filesSelected' && msg.paths) {
          for (var p of msg.paths) {
            if (!selectedFiles.some(function(f) { return f.uri === p.uri; })) {
              selectedFiles.push(p);
            }
          }
          renderChips();
        }
      });

      document.getElementById('run-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const textAreas = document.querySelectorAll('textarea[data-param]');
        const radioGroups = document.querySelectorAll('.radio-group[data-param]');
        const boolCheckboxes = document.querySelectorAll('input[type="checkbox"][data-bool]');
        let query = prefix;
        textAreas.forEach(input => {
          const val = input.value.trim();
          if (val) {
            query += val + ' ';
          }
        });
        radioGroups.forEach(group => {
          const checked = group.querySelector('input[type="radio"]:checked');
          if (checked) {
            query += checked.value.trim() + ' ';
          }
        });
        boolCheckboxes.forEach(cb => {
          query += (cb.checked ? 'true' : 'false') + ' ';
        });
        const attachFiles = selectedFiles.map(function(f) { return f.uri; });
        vscode.postMessage({ command: 'run', query: query.trim(), attachFiles: attachFiles });
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, '&#39;');
}
