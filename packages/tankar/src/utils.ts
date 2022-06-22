export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};
export const ensureArray = <T>(t: T | T[]): T[] => (Array.isArray(t) ? t : [t]);

export const entries = Object.entries;

export const fromEntries = <T extends object>(es: Array<[string, any]>): T =>
  es.reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}) as T;

export const recursiveMerge = <T extends object>(
  a: T,
  b: RecursivePartial<T> = {}
): T => {
  const es = entries(a).map(([key, value]) => {
    // @ts-ignore
    const bValue: any = b[key];
    return [
      key,
      typeof value === "object"
        ? recursiveMerge(value, bValue)
        : bValue || value,
    ] as [string, any];
  });
  return fromEntries<T>(es);
};

export function splitWhen<T>(
  condition: (t: T) => boolean,
  ts: T[]
): [T[], T[]] {
  const index = ts.findIndex(condition);
  return index >= 0 ? [ts.slice(0, index), ts.slice(index)] : [ts, []];
}
