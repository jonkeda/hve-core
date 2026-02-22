import * as vscode from 'vscode';

/** Resolves an artifact relative path to a URI within the extension's bundled directory. */
export function resolveArtifactUri(
  extensionUri: vscode.Uri,
  relativePath: string,
): vscode.Uri {
  // Artifact paths are relative within the bundled/ directory (e.g., "agents/foo.agent.md")
  const cleaned = relativePath.replace(/^\.\//, '');
  return vscode.Uri.joinPath(extensionUri, 'bundled', cleaned);
}

/** Generates a cryptographic nonce for CSP in webview HTML. */
export function getNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
