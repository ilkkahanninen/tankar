import { Store } from "tankar";
import { emptyFetchResource } from "tankar-fetch";
import { State } from "./state";

export const store = new Store<State>({
  todos: emptyFetchResource,
});
