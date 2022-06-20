import { Subscriber, SubscriberList } from "./SubscriberList";
import {
  AbortTransactionFn,
  Patch,
  Transaction,
  TransactionInterface,
} from "./Transaction";

export type TransactionErrorHandler<S> = (error: any) => (state: S) => S;

export class Store<S> {
  readonly initialState: S;
  compactedState: S;
  currentState: S;
  tasks: Array<Transaction<S>>;
  readonly subscribers: SubscriberList<S>;
  errorHandler: TransactionErrorHandler<S>;

  constructor(initialState: S) {
    this.initialState = initialState;
    this.compactedState = initialState;
    this.currentState = initialState;
    this.tasks = [];
    this.subscribers = new SubscriberList();
    this.errorHandler = (error) => (state) => {
      console.error("Unhandler error", error);
      return state;
    };
  }

  dispatch(...p: Array<Patch<S>>): Store<S> {
    const task = new Transaction<S>();
    task.complete(p);
    this.tasks.push(task);
    this.updateState();
    return this;
  }

  tx(
    fn: (a: TransactionInterface<S>) => Promise<void> | void
  ): AbortTransactionFn {
    const task = new Transaction<S>();
    this.tasks.push(task);
    return task.run(fn, this.updateState.bind(this));
  }

  handleErrors(errorHandler: TransactionErrorHandler<S>): Store<S> {
    this.errorHandler = errorHandler;
    return this;
  }

  updateState(): Store<S> {
    this.subscribers.emit(
      this.tasks.reduce(
        (state, task) =>
          task.state === "running" || task.state === "completed"
            ? task.reduce(state)
            : task.state === "thrown"
            ? this.errorHandler(task.error)(state)
            : state,
        this.initialState
      )
    );
    return this;
  }

  compact(): Store<S> {
    let compactedTx: Array<Transaction<S>> = [];
    let compactedState = this.compactedState;

    let compacting = true;
    for (let tx of this.tasks) {
      if (!compacting || tx.state === "pending" || tx.state === "running") {
        compacting = false;
        compactedTx.push(tx);
      } else {
        compactedState = tx.reduce(compactedState);
      }
    }

    this.compactedState = compactedState;
    this.tasks = compactedTx;
    return this;
  }

  hasSettled(): boolean {
    return this.tasks.every(
      (tx) => tx.state !== "pending" && tx.state !== "running"
    );
  }

  history() {
    return this.tasks.map(
      (tx) =>
        `[${tx.state}] ${tx.name}: ${tx.patches
          .map((p) => p.name || p.toString())
          .join(" >> ")}`
    );
  }

  subscribe(subscriber: Subscriber<S>): Store<S> {
    this.subscribers.push(subscriber);
    subscriber(this.initialState);
    return this;
  }

  unsubscribe(subscriber: Subscriber<S>): Store<S> {
    this.subscribers.remove(subscriber);
    return this;
  }
}
