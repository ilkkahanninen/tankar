export const ensureArray = <T>(t: T | T[]): T[] => (Array.isArray(t) ? t : [t]);
