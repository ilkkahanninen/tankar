export class Deferred<T = void, S = void> {
  readonly promise: Promise<T>;
  private resolveFn?: (t: T) => void;
  private rejectFn?: (s: S) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
  }

  resolve(t: T) {
    this.resolveFn?.(t);
  }

  reject(s: S) {
    this.rejectFn?.(s);
  }
}
