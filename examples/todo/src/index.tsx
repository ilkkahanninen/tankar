import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const init = (containerId: string, Root: React.FunctionComponent) => {
  const container = document.getElementById(containerId);
  if (container) {
    const root = createRoot(container);
    root.render(<Root />);
  } else {
    console.error(`Container #${containerId} is missing`);
  }
};

init("app", App);
