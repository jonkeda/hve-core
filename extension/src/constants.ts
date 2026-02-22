export const VIEW_ID = 'hveCore.artifactExplorer';

export const COMMANDS = {
  refresh: 'hveCore.refresh',
  toggleGrouping: 'hveCore.toggleGrouping',
  filterByType: 'hveCore.filterByType',
  runArtifact: 'hveCore.runArtifact',
  openDetail: 'hveCore.openDetail',
  openSettings: 'hveCore.openSettings',
  toggleArtifact: 'hveCore.toggleArtifact',
  enableAll: 'hveCore.enableAll',
  disableAll: 'hveCore.disableAll',
} as const;

export const CONFIG = {
  section: 'hveCore',
  initialized: 'hveCore.artifacts.initialized',
  groupByType: 'hveCore.treeView.groupByType',
} as const;
