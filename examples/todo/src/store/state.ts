import * as O from "optics-ts";
import { FetchResource } from "tankar-fetch";
import { TodosResponse } from "./api";

export type State = {
  todos: FetchResource<TodosResponse, unknown>;
};

export const todosL = O.optic_<State>().prop("todos");
