import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";
// T05 (UI-01): Geist real — @font-face local (ver src/fonts.css). El entry
// JS `geist/font/*` es solo-Next (`next/font`, prohibido por R-FE-3).
import "./fonts.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("No se encontró el elemento raíz '#root' en index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
