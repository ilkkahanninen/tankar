export type Config = {
  compact: CompactionConfig;
};

export type CompactionConfig = {
  /**
   * Enables automatic compacting to save memory usage and improve recomputation of the state.
   * Default: true
   */
  enabled: boolean;
  /**
   * Minimum number of transactions in memory which will trigger compacting.
   * Default: 20
   */
  transactionLimit: number;
};

export const defaultCompactionConfig: CompactionConfig = {
  enabled: true,
  transactionLimit: 20,
};

export const defaultConfig: Config = {
  compact: defaultCompactionConfig,
};
