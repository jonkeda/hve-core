export const VIEW_ID = 'hveCore.artifactExplorer';
export const QUICK_RUN_VIEW_ID = 'hveCore.quickRun';

export const COMMANDS = {
  refresh: 'hveCore.refresh',
  clickArtifact: 'hveCore.clickArtifact',
  runArtifact: 'hveCore.runArtifact',
  openDetail: 'hveCore.openDetail',
  openSettings: 'hveCore.openSettings',
  toggleArtifact: 'hveCore.toggleArtifact',
  addFavorite: 'hveCore.addFavorite',
  removeFavorite: 'hveCore.removeFavorite',
} as const;

export const CONFIG = {
  section: 'hveCore',
  initialized: 'hveCore.artifacts.initialized',
} as const;

export const TRACKING_VIEW_ID = 'hveCore.tracking';

export const TRACKING_COMMANDS = {
  refreshTracking: 'hveCore.refreshTracking',
  openTrackingDetail: 'hveCore.openTrackingDetail',
} as const;
