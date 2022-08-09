import { fetchResource } from "tankar-fetch";

export type TodosResponse = {
  todos: Todo[];
  total: number;
  skip: number;
  limit: number;
};

export type Todo = {
  id: number;
  todo: string;
  completed: boolean;
  userId: number;
};

export const getTodos = fetchResource<TodosResponse, unknown>(
  "https://dummyjson.com/todos"
);
