import * as vscode from 'vscode';

/** Messages sent from the webview to the extension host. */
export type WebviewMessage =
  | { command: 'handoff'; agent?: string; prompt?: string }
  | { command: 'run'; name: string; type: 'agent' | 'prompt' };

/** Handles messages received from the webview panel. */
export async function handleWebviewMessage(message: WebviewMessage): Promise<void> {
  switch (message.command) {
    case 'handoff': {
      const query = message.agent
        ? `@${message.agent} `
        : message.prompt
          ? `/${message.prompt} `
          : '';
      if (query) {
        await vscode.commands.executeCommand('workbench.action.chat.open', { query });
      }
      break;
    }
    case 'run': {
      const query = message.type === 'agent'
        ? `@${message.name} `
        : `/${message.name} `;
      await vscode.commands.executeCommand('workbench.action.chat.open', { query });
      break;
    }
  }
}
