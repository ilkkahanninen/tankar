export type Subscriber<S> = (state: S) => void;

export class SubscriberList<S> {
  readonly subscribers: Array<Subscriber<S>> = [];

  push(subscriber: Subscriber<S>): void {
    this.subscribers.push(subscriber);
  }

  remove(subscriber: Subscriber<S>): void {
    const index = this.subscribers.indexOf(subscriber);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  }

  emit(data: S): void {
    this.subscribers.forEach((subsciber) => subsciber(data));
  }
}
