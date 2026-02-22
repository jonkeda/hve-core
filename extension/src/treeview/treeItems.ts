import * as vscode from 'vscode';
import { type ArtifactItem, type TreeElement } from '../models/types';
import { COMMANDS } from '../constants';
import { getFavorites } from '../settings/configuration';

const TYPE_ICONS: Record<string, vscode.ThemeIcon> = {
  agent: new vscode.ThemeIcon('hubot'),
  prompt: new vscode.ThemeIcon('terminal'),
  instruction: new vscode.ThemeIcon('book'),
};

/** Creates a TreeItem for a category header. */
export function createCategoryItem(label: string): vscode.TreeItem {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
  item.iconPath = new vscode.ThemeIcon('folder');
  item.contextValue = 'category';
  return item;
}

/** Creates a TreeItem for an enabled artifact entry. */
export function createArtifactItem(artifact: ArtifactItem): vscode.TreeItem {
  const item = new vscode.TreeItem(artifact.name, vscode.TreeItemCollapsibleState.None);
  const typeLabel = artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1);
  item.tooltip = new vscode.MarkdownString(`**[${typeLabel}]** ${artifact.name}\n\n${artifact.description}`);
  item.iconPath = TYPE_ICONS[artifact.type] ?? new vscode.ThemeIcon('file');

  const isPrompt = artifact.type === 'prompt';
  const isFav = isPrompt && getFavorites().includes(artifact.name);
  if (isPrompt) {
    item.contextValue = isFav ? 'prompt-fav' : 'prompt';
  } else {
    item.contextValue = artifact.type === 'instruction' ? 'instruction' : 'agent';
  }

  const isRunnable = artifact.type !== 'instruction';
  item.command = {
    command: isRunnable ? COMMANDS.runArtifact : COMMANDS.openDetail,
    title: isRunnable ? 'Run' : 'Details',
    arguments: [{ kind: 'artifact', item: artifact } satisfies TreeElement],
  };

  return item;
}
