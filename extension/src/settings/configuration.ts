import * as vscode from 'vscode';
import { CONFIG } from '../constants';

let _workspaceState: vscode.Memento | undefined;
const _onFavoritesChanged = new vscode.EventEmitter<string[]>();

/** Event that fires when favorites change. */
export const onFavoritesChanged = _onFavoritesChanged.event;

/** Initializes the workspace state reference for favorites storage. */
export function initFavorites(workspaceState: vscode.Memento): void {
  _workspaceState = workspaceState;
}

/** Returns whether artifacts have been initialized in this workspace. */
export function isInitialized(): boolean {
  const config = vscode.workspace.getConfiguration(CONFIG.section);
  return config.get<boolean>('artifacts.initialized', false);
}

/** Records that artifact initialization has completed for this workspace. */
export async function setInitialized(value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG.section);
  await config.update('artifacts.initialized', value, vscode.ConfigurationTarget.Workspace);
}

/** Returns current groupByType setting. */
export function isGroupByType(): boolean {
  const config = vscode.workspace.getConfiguration(CONFIG.section);
  return config.get<boolean>('treeView.groupByType', false);
}

/** Updates the groupByType setting. */
export async function setGroupByType(value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG.section);
  await config.update('treeView.groupByType', value, vscode.ConfigurationTarget.Global);
}

/** Returns the list of favorited prompt names. */
export function getFavorites(): string[] {
  return _workspaceState?.get<string[]>('favorites', []) ?? [];
}

/** Updates the favorites list. */
export async function setFavorites(value: string[]): Promise<void> {
  await _workspaceState?.update('favorites', value);
  _onFavoritesChanged.fire(value);
}
