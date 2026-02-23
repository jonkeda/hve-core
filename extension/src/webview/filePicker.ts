import * as vscode from 'vscode';
import { tmpdir } from 'os';
import { join } from 'path';

/** Handles file picker and paste messages from a webview. Returns true if handled. */
export async function handleFilePickerMessage(
  webview: vscode.Webview,
  message: { command: string; data?: string; mimeType?: string },
): Promise<boolean> {
  switch (message.command) {
    case 'pasteImage': {
      if (!message.data) return true;
      const ext = message.mimeType === 'image/jpeg' ? '.jpg'
        : message.mimeType === 'image/gif' ? '.gif'
        : message.mimeType === 'image/webp' ? '.webp'
        : '.png';
      const fileName = `pasted-${Date.now()}${ext}`;
      const filePath = join(tmpdir(), fileName);
      const fileUri = vscode.Uri.file(filePath);
      const buffer = Buffer.from(message.data, 'base64');
      await vscode.workspace.fs.writeFile(fileUri, buffer);
      await webview.postMessage({
        command: 'filesSelected',
        paths: [{ uri: fileUri.toString(), name: fileName, kind: 'image' }],
      });
      return true;
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
        await webview.postMessage({ command: 'filesSelected', paths });
      }
      return true;
    }
    default:
      return false;
  }
}
