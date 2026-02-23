import * as vscode from 'vscode';
import { marked } from 'marked';
import { type ArtifactItem, type ArtifactFrontmatter } from '../models/types';
import { resolveArtifactUri, getNonce } from '../utils/paths';
import { escapeHtml, escapeAttr } from '../utils/html';
import { parseFrontmatter } from '../utils/frontmatter';
import { handleWebviewMessage, type WebviewMessage } from './messageHandler';

/** Tracks the active detail panel to prevent duplicate panels per artifact. */
const activePanels = new Map<string, vscode.WebviewPanel>();

/** Opens or reveals a detail panel for the given artifact. */
export async function openDetailPanel(
  context: vscode.ExtensionContext,
  artifact: ArtifactItem,
): Promise<void> {
  const existing = activePanels.get(artifact.name);
  if (existing) {
    existing.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'hveCore.artifactDetail',
    artifact.name,
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: false },
  );

  activePanels.set(artifact.name, panel);
  panel.onDidDispose(() => activePanels.delete(artifact.name));

  panel.webview.onDidReceiveMessage(
    (message: WebviewMessage) => handleWebviewMessage(message),
  );

  const fileUri = resolveArtifactUri(context.extensionUri, artifact.path);

  try {
    const content = await vscode.workspace.fs.readFile(fileUri);
    const text = new TextDecoder().decode(content);
    const { frontmatter, body } = parseFrontmatter(text);
    const renderedBody = await marked.parse(body, { gfm: true });

    panel.webview.html = buildDetailHtml(panel.webview, context.extensionUri, artifact, frontmatter, renderedBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[HVE Core] Failed to load artifact "${artifact.name}" from ${fileUri.toString()}: ${msg}`);
    panel.webview.html = buildErrorHtml(panel.webview, artifact.name);
  }
}



/** Builds the complete HTML for the detail webview panel. */
function buildDetailHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  artifact: ArtifactItem,
  frontmatter: ArtifactFrontmatter,
  renderedBody: string,
): string {
  const nonce = getNonce();
  const mermaidScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'mermaid.min.js'),
  );

  const handoffButtons = (frontmatter.handoffs ?? [])
    .map((h) => {
      const data = h.agent
        ? `data-agent="${escapeAttr(h.agent)}"`
        : h.prompt
          ? `data-prompt="${escapeAttr(h.prompt)}"`
          : '';
      const keywordAttr = h.keyword ? ` data-keyword="${escapeAttr(h.keyword)}"` : '';
      const keywordHint = h.keyword ? ` <span class="keyword-hint">/${escapeHtml(h.keyword)}</span>` : '';
      return `<button class="handoff-btn" ${data}${keywordAttr}>${escapeHtml(h.label)}${keywordHint}</button>`;
    })
    .join('\n        ');

  const maturityBadge = frontmatter.maturity
    ? `<span class="badge">${escapeHtml(frontmatter.maturity)}</span>`
    : '';

  const description = frontmatter.description ?? artifact.description;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; img-src data:;">
  <style nonce="${nonce}">
    body {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      padding: 16px;
      margin: 0;
    }
    .header-card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .header-card h2 { margin-top: 0; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.8em;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      margin-left: 8px;
      vertical-align: middle;
    }
    .handoff-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 10px;
      border-radius: 2px;
      cursor: pointer;
      margin-right: 6px;
      margin-top: 8px;
    }
    .handoff-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .markdown-body h1, .markdown-body h2 {
      border-bottom: 1px solid var(--vscode-widget-border);
      padding-bottom: 0.3em;
    }
    .markdown-body code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .markdown-body pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .markdown-body a {
      color: var(--vscode-textLink-foreground);
    }
    .mermaid-diagram {
      background: var(--vscode-editor-background);
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      text-align: center;
    }
    .mermaid-diagram svg {
      max-width: 100%;
      height: auto;
    }
    .keyword-hint {
      font-size: 0.75em;
      opacity: 0.6;
      margin-left: 4px;
      font-family: var(--vscode-editor-font-family);
    }
  </style>
</head>
<body>
  <div class="header-card">
    <h2>${escapeHtml(artifact.name)} ${maturityBadge}</h2>
    <p>${escapeHtml(description)}</p>
    ${handoffButtons ? `<div class="handoffs">${handoffButtons}</div>` : ''}
  </div>
  <div class="markdown-body">${renderedBody}</div>
  <script src="${mermaidScriptUri}" nonce="${nonce}"></script>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      document.querySelectorAll('.handoff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const agent = btn.getAttribute('data-agent');
          const prompt = btn.getAttribute('data-prompt');
          vscode.postMessage({ command: 'handoff', agent, prompt });
        });
      });

      const isDark = document.body.classList.contains('vscode-dark') ||
        document.body.getAttribute('data-vscode-theme-kind') === 'vscode-dark';
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'strict',
      });
      document.querySelectorAll('code.language-mermaid').forEach(async (el, i) => {
        const container = el.parentElement;
        const { svg } = await mermaid.render('mermaid-' + i, el.textContent);
        container.outerHTML = '<div class="mermaid-diagram">' + svg + '</div>';
      });
    })();
  </script>
</body>
</html>`;
}

/** Builds error HTML when artifact file cannot be read. */
function buildErrorHtml(webview: vscode.Webview, name: string): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}';">
  <style nonce="${nonce}">
    body {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      padding: 16px;
    }
  </style>
</head>
<body>
  <h2>Unable to load artifact</h2>
  <p>Could not read the file for <strong>${escapeHtml(name)}</strong>.</p>
</body>
</html>`;
}


