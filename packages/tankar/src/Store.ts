import { Subscriber, SubscriberList } from "./SubscriberList";
import {
  AbortTransactionFn,
  Patch,
  Transaction,
  TransactionInterface,
} from "./Transaction";
import { ensureArray } from "./utils";

export type TransactionErrorHandler<S> = (error: any) => (state: S) => S;
export type WorkerFn<T> = (a: TransactionInterface<T>) => Promise<void> | void;

export class Store<S> {
  readonly initialState: S;
  compactedState: S;
  currentState: S;
  transactions: Array<Transaction<S>>;
  readonly subscribers: SubscriberList<S>;
  errorHandler: TransactionErrorHandler<S>;

  constructor(initialState: S) {
    this.initialState = initialState;
    this.compactedState = initialState;
    this.currentState = initialState;
    this.transactions = [];
    this.subscribers = new SubscriberList();
    this.errorHandler = (error) => (state) => {
      console.error("Unhandler error", error);
      return state;
    };
  }

  dispatch(...p: Array<Patch<S>>): Store<S> {
    const task = new Transaction<S>();
    task.complete(p);
    this.transactions.push(task);
    this.updateState();
    return this;
  }

  dispatchFn<A extends any[]>(fn: (...a: A) => Array<Patch<S>> | Patch<S>) {
    return (...a: A) => {
      this.dispatch(...ensureArray(fn(...a)));
    };
  }

  startTransaction(worker: WorkerFn<S>): AbortTransactionFn {
    const task = new Transaction<S>();
    this.transactions.push(task);
    return task.run(worker, this.updateState.bind(this));
  }

  transactionFn<A extends any[]>(fn: (...a: A) => WorkerFn<S>) {
    return async (...a: A) => {
      this.startTransaction(fn(...a));
    };
  }

  handleErrors(errorHandler: TransactionErrorHandler<S>): Store<S> {
    this.errorHandler = errorHandler;
    return this;
  }

  updateState(): Store<S> {
    this.subscribers.emit(
      this.transactions.reduce(
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
    for (let tx of this.transactions) {
      if (!compacting || tx.state === "pending" || tx.state === "running") {
        compacting = false;
        compactedTx.push(tx);
      } else {
        compactedState = tx.reduce(compactedState);
      }
    }

    this.compactedState = compactedState;
    this.transactions = compactedTx;
    return this;
  }

  hasSettled(): boolean {
    return this.transactions.every(
      (tx) => tx.state !== "pending" && tx.state !== "running"
    );
  }

  history() {
    return this.transactions.map(
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
