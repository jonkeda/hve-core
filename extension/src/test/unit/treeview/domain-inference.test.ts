import { describe, it, expect } from 'vitest';
import { inferDomain, type ArtifactItem } from '../../../models/types';

describe('domain grouping', () => {
  const sampleArtifacts: ArtifactItem[] = [
    { name: 'ado-prd-to-wit', type: 'agent', path: './', description: '', enabled: true },
    { name: 'task-planner', type: 'agent', path: './', description: '', enabled: true },
    { name: 'git-commit', type: 'prompt', path: './', description: '', enabled: true },
    { name: 'memory', type: 'agent', path: './', description: '', enabled: false },
  ];

  it('groups artifacts by domain', () => {
    const grouped = new Map<string, ArtifactItem[]>();
    for (const a of sampleArtifacts) {
      const domain = inferDomain(a.name);
      if (!grouped.has(domain)) grouped.set(domain, []);
      grouped.get(domain)!.push(a);
    }

    expect(grouped.get('Azure DevOps')).toHaveLength(1);
    expect(grouped.get('RPI')).toHaveLength(1);
    expect(grouped.get('Git')).toHaveLength(1);
    expect(grouped.get('General')).toHaveLength(1);
  });

  it('produces sorted unique domain names', () => {
    const domains = [...new Set(sampleArtifacts.map((a) => inferDomain(a.name)))].sort();
    expect(domains).toEqual(['Azure DevOps', 'General', 'Git', 'RPI']);
  });
});
