export type Config = {
  compact: CompactionConfig;
};

export type CompactionConfig = {
  /**
   * Enables automatic compacting to save memory usage and improve recomputation of the state.
   * Default: true
   */
  enabled: boolean;
};

export const defaultCompactionConfig: CompactionConfig = {
  enabled: true,
};

export const defaultConfig: Config = {
  compact: defaultCompactionConfig,
};
