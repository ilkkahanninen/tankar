import { Deferred } from "./Deferred";
import { defer } from "./utils";

export type TransactionInterface<S> = {
  dispatch: (...fs: Patch<S>[]) => void;
  replace: (...fs: Patch<S>[]) => void;
  abortController: AbortController;
  settledState: Promise<S>;
};

export type Patch<S> = (prevState: S) => S;
export type Worker<S> = (a: TransactionInterface<S>) => Promise<void> | void;

export type AbortTransactionFn = () => void;

export type TransactionState =
  | "pending"
  | "running"
  | "completed"
  | "aborted"
  | "thrown";

const updateErrors = {
  completed:
    "Tried to update the state of a completed transaction. Did the function return before completing all its callbacks and/or promises?",
  aborted: "Tried to update the state of an aborted transaction.",
  thrown:
    "Tried to update the state of a transaction which has thrown an error earlier.",
};

export class Transaction<S> {
  state: TransactionState;
  patches: Array<Patch<S>>;
  error: any;
  name?: string;
  private settledState: Deferred<S>;

  constructor() {
    this.state = "pending";
    this.patches = [];
    this.name = undefined;
    this.settledState = new Deferred<S>();
  }

  run(
    work: Worker<S>,
    onUpdate: () => void,
    onEnd: () => void
  ): AbortTransactionFn {
    const abortController = new AbortController();
    this.name = work.name || "anonymous";

    const update =
      (fn: (p: Array<Patch<S>>) => void) =>
      (...p: Array<Patch<S>>): void => {
        if (this.state === "running") {
          fn(p);
          onUpdate();
        } else if (this.state === "completed") {
          console.warn(updateErrors[this.state]);
        }
      };

    const self = this;

    abortController.signal.addEventListener("abort", () => {
      self.state = "aborted";
      onUpdate();
    });

    defer(async () => {
      if (self.state === "aborted") {
        return;
      }
      self.state = "running";
      try {
        await work({
          dispatch: update((p) => {
            self.patches.push(...p);
          }),
          replace: update((p) => {
            self.patches = p;
          }),
          abortController,
          settledState: this.settledState.promise,
        });
        // @ts-ignore
        if (self.state !== "aborted") {
          self.state = "completed";
        }
      } catch (err) {
        self.state = "thrown";
        self.error = err;
        onUpdate();
      }
      onEnd();
    });

    return () => {
      if (this.state === "pending" || this.state === "running") {
        abortController.abort();
      }
    };
  }

  complete(patches: Array<Patch<S>> = []): Transaction<S> {
    this.state = "completed";
    this.patches = patches;
    this.name = "patch";
    return this;
  }

  reduce(state: S): S {
    return this.patches.reduce((prevState, patch) => patch(prevState), state);
  }

  hasSettled(): boolean {
    return this.state !== "pending" && this.state !== "running";
  }

  setSettledState(state: S) {
    this.settledState.resolve(state);
  }
}
