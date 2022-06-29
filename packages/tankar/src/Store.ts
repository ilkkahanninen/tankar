import { Config, defaultConfig } from "./config";
import { Subscriber, SubscriberList } from "./SubscriberList";
import {
  AbortTransactionFn,
  Patch,
  Transaction,
  TransactionInterface,
} from "./Transaction";
import {
  ensureArray,
  recursiveMerge,
  RecursivePartial,
  splitWhen,
} from "./utils";

export type TransactionErrorHandler<S> = (error: any) => (state: S) => S;
export type WorkerFn<T> = (a: TransactionInterface<T>) => Promise<void> | void;

export class Store<S> {
  readonly initialState: S;
  compactedState: S;
  currentState: S;
  transactions: Array<Transaction<S>>;
  readonly subscribers: SubscriberList<S>;
  errorHandler: TransactionErrorHandler<S>;
  readonly config: Config;

  constructor(initialState: S, config: RecursivePartial<Config> = {}) {
    this.config = recursiveMerge(defaultConfig, config);
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

  startTransaction(worker: WorkerFn<S>): AbortTransactionFn {
    const transaction = new Transaction<S>();
    this.push(transaction);
    return transaction.run(worker, () => {
      this.updateState();
      if (transaction.hasSettled()) {
        this.compact();
      }
    });
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
      this.computeState(this.transactions, this.compactedState)
    );
    return this;
  }

  compact(): Store<S> {
    const [compactableTxs, restOfTxs] = splitWhen(
      (tx) => !tx.hasSettled(),
      this.transactions
    );
    this.compactedState = this.computeState(
      compactableTxs,
      this.compactedState
    );
    this.transactions = restOfTxs;
    return this;
  }

  hasSettled(): boolean {
    return this.transactions.every((tx) => tx.hasSettled());
  }

  subscribe(subscriber: Subscriber<S>): Store<S> {
    this.subscribers.push(subscriber);
    subscriber(this.compactedState);
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
}
