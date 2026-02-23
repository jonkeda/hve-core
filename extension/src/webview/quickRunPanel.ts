import * as vscode from 'vscode';
import { type ArtifactItem } from '../models/types';
import { getNonce } from '../utils/paths';
import { escapeHtml, escapeAttr } from '../utils/html';
import { getFavorites } from '../settings/configuration';
import { handleFilePickerMessage } from './filePicker';
import { openRunPanel } from './runPanel';

export class QuickRunViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _artifacts: ArtifactItem[] = [];

  constructor(private readonly _context: vscode.ExtensionContext) {}

  setArtifacts(artifacts: ArtifactItem[]): void {
    this._artifacts = artifacts;
  }

  refresh(): void {
    if (!this._view) return;
    this._view.webview.postMessage({
      command: 'updateFavorites',
      favorites: getFavorites(),
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (message: {
      command: string;
      query?: string;
      name?: string;
      attachFiles?: string[];
      data?: string;
      mimeType?: string;
    }) => {
      if (await handleFilePickerMessage(webviewView.webview, message)) return;

      switch (message.command) {
        case 'run': {
          if (!message.query) break;
          const opts: Record<string, unknown> = { query: message.query };
          if (message.attachFiles?.length) {
            opts.attachFiles = message.attachFiles.map(
              (f: string) => vscode.Uri.parse(f),
            );
          }
          await vscode.commands.executeCommand('workbench.action.chat.open', opts);
          break;
        }
        case 'openRunPage': {
          const artifact = this._artifacts.find(
            (a) => a.name === message.name && a.type === 'prompt' && a.enabled,
          );
          if (artifact) {
            await openRunPanel(this._context, artifact);
          }
          break;
        }
      }
    });

    webviewView.webview.html = this._buildHtml(webviewView.webview);
  }

  private _buildHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const favorites = getFavorites();

    const favoriteOptions = favorites
      .map(f => `<option value="${escapeAttr(f)}">${escapeHtml(f)}</option>`)
      .join('\n        ');

    const body = favorites.length > 0
      ? `<div class="field">
  <label for="prompt-select">Prompt</label>
  <select id="prompt-select">
    ${favoriteOptions}
  </select>
</div>
<div class="field grow">
  <label for="task-input">Task</label>
  <textarea id="task-input" placeholder="Describe your task..."></textarea>
</div>
<div class="btn-row">
  <button class="run-btn" id="run-btn">&#9654; Run</button>
  <button class="open-btn" id="open-btn" title="Open full Run page">&#8679;</button>
</div>
<div class="ctx-row">
  <button class="ctx-btn" data-pick="pickFiles" title="Add files">&#128196;</button>
  <button class="ctx-btn" data-pick="pickFolders" title="Add folders">&#128193;</button>
  <button class="ctx-btn" data-pick="pickImages" title="Add images">&#128444;&#65039;</button>
  <button class="ctx-btn" id="paste-btn" title="Paste image">&#128203;</button>
</div>
<div class="chip-container" id="chip-container"></div>`
      : `<div class="empty-msg">
  No favorites yet.<br/>Star a prompt in the Artifacts tree to add it here.
</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    html, body {
      height: 100%;
      margin: 0;
    }
    body {
      padding: 8px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      font-size: var(--vscode-font-size);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    .field { margin-bottom: 6px; }
    .field.grow {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .field.grow textarea { flex: 1; }
    .field label {
      display: block;
      font-size: 0.85em;
      font-weight: 600;
      margin-bottom: 3px;
      opacity: 0.8;
    }
    select, textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 5px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.4));
      border-radius: 3px;
      font-family: var(--vscode-font-family);
      font-size: inherit;
    }
    select:focus, textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    textarea { resize: none; min-height: 2.4em; }

    .btn-row { display: flex; gap: 4px; margin: 8px 0 6px; }
    .run-btn {
      flex: 1;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 600;
    }
    .run-btn:hover { background: var(--vscode-button-hoverBackground); }
    .run-btn:disabled { opacity: 0.5; cursor: default; }
    .open-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 6px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.9em;
    }
    .open-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .open-btn:disabled { opacity: 0.5; cursor: default; }

    .ctx-row { display: flex; gap: 4px; margin-bottom: 6px; }
    .ctx-btn {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.4));
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85em;
      flex: 1;
      text-align: center;
    }
    .ctx-btn:hover {
      background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
    }

    .chip-container { display: flex; flex-wrap: wrap; gap: 4px; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: color-mix(in srgb, var(--vscode-badge-background, #616161) 30%, transparent);
      color: var(--vscode-foreground);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 0.78em;
      max-width: 180px;
    }
    .chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip-remove {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 0 1px;
      font-size: 0.95em;
      opacity: 0.7;
      line-height: 1;
    }
    .chip-remove:hover { opacity: 1; }
    .empty-msg {
      font-size: 0.82em;
      opacity: 0.6;
      text-align: center;
      padding: 12px 4px;
    }
  </style>
</head>
<body>
  ${body}
  <script nonce="${nonce}">
    (function() {
      var vscode = acquireVsCodeApi();
      var prevState = vscode.getState() || {};
      var selectedFiles = prevState.selectedFiles || [];

      var promptSelect = document.getElementById('prompt-select');
      var taskInput = document.getElementById('task-input');
      var runBtn = document.getElementById('run-btn');
      var openBtn = document.getElementById('open-btn');
      var chipContainer = document.getElementById('chip-container');

      function saveState() {
        vscode.setState({
          prompt: promptSelect ? promptSelect.value : '',
          task: taskInput ? taskInput.value : '',
          selectedFiles: selectedFiles
        });
      }

      if (promptSelect && prevState.prompt) { promptSelect.value = prevState.prompt; }
      if (taskInput && prevState.task) { taskInput.value = prevState.task; }

      function esc(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      function renderChips() {
        if (!chipContainer) return;
        chipContainer.innerHTML = selectedFiles.map(function(f, i) {
          var icon = f.kind === 'folder' ? '\\uD83D\\uDCC1' : f.kind === 'image' ? '\\uD83D\\uDDBC\\uFE0F' : '\\uD83D\\uDCC4';
          return '<span class="chip" title="' + esc(f.uri) + '">' +
            '<span>' + icon + '</span>' +
            '<span class="chip-name">' + esc(f.name) + '</span>' +
            '<button type="button" class="chip-remove" data-idx="' + i + '">&times;</button>' +
            '</span>';
        }).join('');
        saveState();
      }

      renderChips();

      if (chipContainer) {
        chipContainer.addEventListener('click', function(e) {
          var btn = e.target.closest('.chip-remove');
          if (btn) {
            selectedFiles.splice(Number(btn.dataset.idx), 1);
            renderChips();
          }
        });
      }

      if (promptSelect) {
        promptSelect.addEventListener('change', saveState);
      }
      if (taskInput) {
        taskInput.addEventListener('input', saveState);
      }

      if (runBtn && promptSelect) {
        runBtn.addEventListener('click', function() {
          var name = promptSelect.value;
          if (!name) return;
          var text = taskInput ? taskInput.value.trim() : '';
          var query = '/' + name + (text ? ' ' + text : '');
          var attachFiles = selectedFiles.map(function(f) { return f.uri; });
          vscode.postMessage({ command: 'run', query: query, attachFiles: attachFiles });
        });
      }

      if (openBtn && promptSelect) {
        openBtn.addEventListener('click', function() {
          var name = promptSelect.value;
          if (!name) return;
          vscode.postMessage({ command: 'openRunPage', name: name });
        });
      }

      document.querySelectorAll('.ctx-btn[data-pick]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          vscode.postMessage({ command: btn.dataset.pick });
        });
      });

      var pasteBtn = document.getElementById('paste-btn');
      if (pasteBtn) {
        pasteBtn.addEventListener('click', async function() {
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
          } catch (_e) { /* clipboard not available */ }
        });
      }

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
        if (msg.command === 'updateFavorites' && msg.favorites) {
          if (!promptSelect) return;
          var prev = promptSelect.value;
          promptSelect.innerHTML = msg.favorites
            .map(function(f) {
              return '<option value="' + esc(f) + '">' + esc(f) + '</option>';
            })
            .join('');
          if (msg.favorites.indexOf(prev) >= 0) {
            promptSelect.value = prev;
          }
        }
      });
    })();
  </script>
</body>
</html>`;
  }
}


