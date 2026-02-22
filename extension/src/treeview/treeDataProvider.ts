import * as vscode from 'vscode';
import {
  type ArtifactItem,
  type ArtifactType,
  type TreeElement,
  inferDomain,
} from '../models/types';
import { isGroupByType } from '../settings/configuration';
import { createArtifactItem, createCategoryItem } from './treeItems';

export class ArtifactTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private artifacts: ArtifactItem[] = [];
  private typeFilter: ArtifactType | null = 'prompt';

  constructor() {}

  /** Sets the type filter and refreshes. Null means show all. */
  setTypeFilter(type: ArtifactType | null): void {
    this.typeFilter = type;
    this.refresh();
  }

  /** Returns the current type filter. */
  getTypeFilter(): ArtifactType | null {
    return this.typeFilter;
  }

  /** Returns enabled artifacts filtered by the current type filter. */
  private getFilteredArtifacts(): ArtifactItem[] {
    const enabled = this.artifacts.filter((a) => a.enabled);
    if (!this.typeFilter) return enabled;
    return enabled.filter((a) => a.type === this.typeFilter);
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

    if (isGroupByType()) {
      const types: { label: string; type: ArtifactType }[] = [
        { label: 'Agents', type: 'agent' },
        { label: 'Prompts', type: 'prompt' },
        { label: 'Instructions', type: 'instruction' },
      ];
      return types
        .filter((t) => all.some((a) => a.type === t.type))
        .map((t) => ({ kind: 'category' as const, label: t.label }));
    }

    // Domain-based grouping — prefer explicit category from manifest, fall back to inferDomain
    const domains = [...new Set(all.map((a) => a.category ?? inferDomain(a.name)))];
    return domains.sort().map((label) => ({ kind: 'category' as const, label }));
  }

  private getCategoryChildren(categoryLabel: string): TreeElement[] {
    const all = this.getFilteredArtifacts();

    if (isGroupByType()) {
      const typeMap: Record<string, ArtifactType> = {
        Agents: 'agent',
        Prompts: 'prompt',
        Instructions: 'instruction',
      };
      const targetType = typeMap[categoryLabel];
      if (!targetType) return [];
      return all
        .filter((a) => a.type === targetType)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({ kind: 'artifact' as const, item }));
    }

    // Domain grouping — prefer explicit category from manifest, fall back to inferDomain
    return all
      .filter((a) => (a.category ?? inferDomain(a.name)) === categoryLabel)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ kind: 'artifact' as const, item }));
  }
}
