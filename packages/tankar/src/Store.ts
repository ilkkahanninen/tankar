import { Config, defaultConfig } from "./config";
import { Subscriber, SubscriberList } from "./SubscriberList";
import {
  AbortTransactionFn,
  Patch,
  Transaction,
  TransactionInterface,
} from "./Transaction";
import {
  debounce,
  ensureArray,
  recursiveMerge,
  RecursivePartial,
  splitWhen,
} from "./utils";

export type TransactionErrorHandler<S> = (error: any) => (state: S) => S;
export type WorkerFn<T> = (a: TransactionInterface<T>) => Promise<void> | void;

export class Store<S> {
  readonly initialState: S;
  settledState: S;
  currentState: S;
  transactions: Array<Transaction<S>>;
  readonly subscribers: SubscriberList<S>;
  errorHandler: TransactionErrorHandler<S>;
  readonly config: Config;

  constructor(initialState: S, config: RecursivePartial<Config> = {}) {
    this.config = recursiveMerge(defaultConfig, config);
    this.initialState = initialState;
    this.settledState = initialState;
    this.currentState = initialState;
    this.transactions = [];
    this.subscribers = new SubscriberList();
    this.errorHandler = (error) => (state) => {
      console.error("Unhandler error", error);
      return state;
    };
  }

  dispatch(...p: Array<Patch<S>>): Store<S> {
    const transaction = new Transaction<S>().complete(p);
    this.push(transaction);
    this.currentState = this.computeState([transaction], this.currentState);
    this.subscribers.emit(this.currentState);
    this.compact();
    return this;
  }

  dispatchFn<A extends any[]>(fn: (...a: A) => Array<Patch<S>> | Patch<S>) {
    return (...a: A) => {
      this.dispatch(...ensureArray(fn(...a)));
    };
  }

  run(worker: WorkerFn<S>): AbortTransactionFn {
    const transaction = new Transaction<S>();
    this.push(transaction);
    return transaction.run(
      worker,
      () => this.updateState(),
      () => this.deferCompact()
    );
  }

  transactionFn<A extends any[]>(fn: (...a: A) => WorkerFn<S>) {
    return async (...a: A) => {
      this.run(fn(...a));
    };
  }

  handleErrors(errorHandler: TransactionErrorHandler<S>): Store<S> {
    this.errorHandler = errorHandler;
    return this;
  }

  updateState(): Store<S> {
    this.subscribers.emit(
      this.computeState(this.transactions, this.settledState)
    );
    return this;
  }

  compact(): Store<S> {
    const [compactableTxs, restOfTxs] = splitWhen(
      (tx) => !tx.hasSettled(),
      this.transactions
    );
    this.settledState = this.computeState(compactableTxs, this.settledState);
    this.transactions = restOfTxs;
    this.transactions[0]?.setSettledState(this.settledState);
    return this;
  }

  hasSettled(): boolean {
    return this.transactions.length === 0 && !this.deferCompact.isPending();
  }

  subscribe(subscriber: Subscriber<S>): Store<S> {
    this.subscribers.push(subscriber);
    subscriber(this.settledState);
    return this;
  }

  unsubscribe(subscriber: Subscriber<S>): Store<S> {
    this.subscribers.remove(subscriber);
    return this;
  }

  private computeState(
    transactions: Array<Transaction<S>>,
    initialState: S
  ): S {
    return transactions.reduce(
      (state, transaction) =>
        transaction.state === "running" || transaction.state === "completed"
          ? transaction.reduce(state)
          : transaction.state === "thrown"
          ? this.errorHandler(transaction.error)(state)
          : state,
      initialState
    );
  }

  private push(tx: Transaction<S>): Store<S> {
    this.transactions.push(tx);
    return this;
  }

  private deferCompact = debounce(0, () => this.compact());
}
