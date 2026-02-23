import * as vscode from 'vscode';
import {
  type ArtifactItem,
  type TreeElement,
  inferDomain,
} from '../models/types';
import { createArtifactItem, createCategoryItem } from './treeItems';

export class ArtifactTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private artifacts: ArtifactItem[] = [];

  constructor() {}

  /** Returns enabled prompt artifacts. */
  private getFilteredArtifacts(): ArtifactItem[] {
    return this.artifacts.filter((a) => a.enabled && a.type === 'prompt');
  }

  /** Replaces the full artifact list and refreshes the tree. */
  setArtifacts(items: ArtifactItem[]): void {
    this.artifacts = items;
    this.refresh();
  }

  /** Fires tree data change event to refresh all nodes. */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    if (element.kind === 'category') {
      return createCategoryItem(element.label);
    }
    return createArtifactItem(element.item);
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      return this.getRootChildren();
    }

    if (element.kind === 'category') {
      return this.getCategoryChildren(element.label);
    }

    return [];
  }

  private getRootChildren(): TreeElement[] {
    const all = this.getFilteredArtifacts();
    const domains = [...new Set(all.map((a) => a.category ?? inferDomain(a.name)))];
    return domains.sort().map((label) => ({ kind: 'category' as const, label }));
  }

  private getCategoryChildren(categoryLabel: string): TreeElement[] {
    const all = this.getFilteredArtifacts();
    return all
      .filter((a) => (a.category ?? inferDomain(a.name)) === categoryLabel)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ kind: 'artifact' as const, item }));
  }
}
