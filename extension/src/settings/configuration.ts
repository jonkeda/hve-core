import * as vscode from 'vscode';
import { CONFIG } from '../constants';

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
