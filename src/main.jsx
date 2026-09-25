import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./ezstay/styles/tokens.css";
import "./ezstay/styles/app.css";
import "./ezstay/styles/utility.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
