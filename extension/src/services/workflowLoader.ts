import * as vscode from 'vscode';
import { type WorkflowConfig, type PhaseDefinition, type AuxiliaryFolder } from '../models/trackingTypes';

export class WorkflowLoader {
  private configs: Map<string, WorkflowConfig> = new Map();

  /** Load all workflow definitions from bundled/workflows/*.workflow.md */
  async initialize(extensionUri: vscode.Uri): Promise<void> {
    const workflowsUri = vscode.Uri.joinPath(extensionUri, 'bundled', 'workflows');
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(workflowsUri);
    } catch (err) {
      console.warn(`WorkflowLoader: cannot read ${workflowsUri.toString()}:`, err);
      return;
    }

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File || !name.endsWith('.workflow.md')) continue;
      const fileUri = vscode.Uri.joinPath(workflowsUri, name);
      try {
        const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        const config = this.parseWorkflowFrontmatter(content);
        if (config) {
          this.configs.set(config.category.toLowerCase(), config);
        }
      } catch {
        console.warn(`WorkflowLoader: failed to read ${name}`);
      }
    }
  }

  getConfig(category: string): WorkflowConfig | undefined {
    return this.configs.get(category.toLowerCase());
  }

  getAllConfigs(): WorkflowConfig[] {
    return [...this.configs.values()];
  }

  private parseWorkflowFrontmatter(text: string): WorkflowConfig | null {
    const normalized = text.replace(/\r\n/g, '\n');
    const fmMatch = normalized.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      console.warn('WorkflowLoader: no frontmatter found');
      return null;
    }

    const lines = fmMatch[1].split('\n');
    const scalars: Record<string, string> = {};
    let phases: PhaseDefinition[] = [];
    let auxiliaryFolders: AuxiliaryFolder[] = [];
    let lifecycleStates: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Skip blank lines
      if (line.trim() === '') { i++; continue; }

      // Top-level key: value
      const topMatch = line.match(/^(\w+):\s*(.*)$/);
      if (!topMatch) { i++; continue; }

      const key = topMatch[1];
      const value = topMatch[2].trim();

      if (key === 'phases') {
        const result = this.parseObjectArray(lines, i + 1, 2);
        phases = result.items.map((item) => this.toPhaseDefinition(item));
        i = result.nextIndex;
      } else if (key === 'auxiliaryFolders') {
        const result = this.parseObjectArray(lines, i + 1, 2);
        auxiliaryFolders = result.items.map((item) => ({
          id: (item['id'] as string) ?? '',
          label: (item['label'] as string) ?? '',
          folder: (item['folder'] as string) ?? '',
        }));
        i = result.nextIndex;
      } else if (key === 'lifecycleStates') {
        const result = this.parseStringArray(lines, i + 1, 2);
        lifecycleStates = result.items;
        i = result.nextIndex;
      } else {
        scalars[key] = stripQuotes(value);
        i++;
      }
    }

    if (!scalars['category']) {
      console.warn('WorkflowLoader: missing category in frontmatter');
      return null;
    }

    return {
      category: scalars['category'],
      displayName: scalars['displayName'] ?? '',
      icon: scalars['icon'] ?? '',
      phases,
      auxiliaryFolders,
      lifecycleStates: lifecycleStates.length > 0 ? lifecycleStates : ['active'],
      instancePattern: scalars['instancePattern'] ?? '',
    };
  }

  private parseObjectArray(
    lines: string[], startIndex: number, baseIndent: number,
  ): { items: Record<string, string | string[] | Record<string, string>[]>[]; nextIndex: number } {
    const items: Record<string, string | string[] | Record<string, string>[]>[] = [];
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { i++; continue; }

      const indent = line.search(/\S/);
      if (indent < baseIndent) break;

      // New array item: "  - key: value"
      const itemMatch = line.match(new RegExp(`^\\s{${baseIndent}}-\\s+(\\w+):\\s*(.*)$`));
      if (!itemMatch) break;

      const obj: Record<string, string | string[] | Record<string, string>[]> = {};
      obj[itemMatch[1]] = stripQuotes(itemMatch[2].trim());
      i++;

      // Read nested properties (aligned with the key after "- ", so baseIndent + 2)
      const propIndent = baseIndent + 2;
      while (i < lines.length) {
        const nested = lines[i];
        if (nested.trim() === '') { i++; continue; }

        const nestedIndent = nested.search(/\S/);
        if (nestedIndent < propIndent) break;

        const propMatch = nested.match(new RegExp(`^\\s{${propIndent}}(\\w+):\\s*(.*)$`));
        if (!propMatch) break;

        const propKey = propMatch[1];
        const propValue = propMatch[2].trim();

        if (propValue === '' || propValue === undefined) {
          // Nested array (branches or feedbackTo)
          if (propKey === 'branches') {
            const sub = this.parseObjectArray(lines, i + 1, propIndent + 2);
            obj[propKey] = sub.items as Record<string, string>[];
            i = sub.nextIndex;
          } else {
            const sub = this.parseStringArray(lines, i + 1, propIndent + 2);
            obj[propKey] = sub.items;
            i = sub.nextIndex;
          }
        } else {
          obj[propKey] = stripQuotes(propValue);
          i++;
        }
      }

      items.push(obj);
    }

    return { items, nextIndex: i };
  }

  private parseStringArray(
    lines: string[], startIndex: number, baseIndent: number,
  ): { items: string[]; nextIndex: number } {
    const items: string[] = [];
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { i++; continue; }

      const indent = line.search(/\S/);
      if (indent < baseIndent) break;

      const match = line.match(new RegExp(`^\\s{${baseIndent}}-\\s+(.+)$`));
      if (!match) break;

      items.push(stripQuotes(match[1].trim()));
      i++;
    }

    return { items, nextIndex: i };
  }

  private toPhaseDefinition(item: Record<string, string | string[] | Record<string, string>[]>): PhaseDefinition {
    const phase: PhaseDefinition = {
      id: (item['id'] as string) ?? '',
      label: (item['label'] as string) ?? '',
      icon: (item['icon'] as string) ?? '',
      folder: (item['folder'] as string) ?? '',
    };
    if (item['agent']) phase.agent = item['agent'] as string;
    if (item['prompt']) phase.prompt = item['prompt'] as string;
    if (item['feedbackTo']) phase.feedbackTo = item['feedbackTo'] as string[];
    if (item['branches']) {
      phase.branches = (item['branches'] as Record<string, string>[]).map(
        (b) => this.toPhaseDefinition(b as Record<string, string | string[] | Record<string, string>[]>),
      );
    }
    return phase;
  }
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
