import { type ArtifactFrontmatter, type HandoffEntry } from '../models/types';

/** Parses YAML frontmatter from a markdown string. Returns frontmatter fields and body text. */
export function parseFrontmatter(text: string): { frontmatter: ArtifactFrontmatter; body: string } {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: normalized };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter: ArtifactFrontmatter = {};

  // Simple YAML key-value parsing for known fields
  // Avoids a full YAML parser dependency for the extension bundle
  for (const line of yamlBlock.split('\n')) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (!kvMatch) continue;

    const [, key, value] = kvMatch;
    const cleaned = value.replace(/^['"]|['"]$/g, '');

    switch (key) {
      case 'description':
        frontmatter.description = cleaned;
        break;
      case 'maturity':
        frontmatter.maturity = cleaned;
        break;
      case 'agent':
        frontmatter.agent = cleaned;
        break;
      case 'applyTo':
        frontmatter.applyTo = cleaned;
        break;
      case 'argument-hint':
        frontmatter.argumentHint = cleaned;
        break;
      case 'category':
        frontmatter.category = cleaned;
        break;
    }
  }

  // Parse handoffs array (multi-line YAML)
  const handoffsMatch = yamlBlock.match(/handoffs:\s*\n((?:\s+-[\s\S]*?)*)(?=\n\w|\n---|$)/);
  if (handoffsMatch) {
    frontmatter.handoffs = parseHandoffs(handoffsMatch[1]);
  }

  return { frontmatter, body };
}

/** Parses handoff entries from YAML array notation. */
export function parseHandoffs(yaml: string): HandoffEntry[] {
  const entries: HandoffEntry[] = [];
  const blocks = yaml.split(/\n\s*-\s+/).filter(Boolean);

  for (const block of blocks) {
    const entry: HandoffEntry = { label: '' };
    for (const line of block.split('\n')) {
      const kvMatch = line.match(/^\s*(\w+):\s*(.+)$/);
      if (!kvMatch) continue;
      const [, key, value] = kvMatch;
      const cleaned = value.replace(/^['"]|['"]$/g, '');
      if (key === 'label') entry.label = cleaned;
      if (key === 'agent') entry.agent = cleaned;
      if (key === 'prompt') entry.prompt = cleaned;
      if (key === 'send') entry.send = cleaned === 'true';
      if (key === 'keyword') entry.keyword = cleaned;
    }
    if (entry.label) entries.push(entry);
  }

  return entries;
}
