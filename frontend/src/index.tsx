import "@fontsource/roboto-mono";
import React from "react";
import ReactDOM from "react-dom";
import "./assets/styles.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

import { createGlobalStyle } from "styled-components";
import tw from "twin.macro";

import colors from "./colors";

const GlobalStyle = createGlobalStyle`
  body {
    font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    ${tw`bg-gray-100`}
  }

  .cytoscape-navigatorOverlay {
    user-select: none !important;
  }

  .cytoscape-navigator {
    z-index: 100 !important;
    border: 2px solid black;
    right: 10px;
    bottom: 10px;
    height: 300px;
  }

  .cytoscape-navigatorView {
    background: #eee;
  }

  .cloud-icon {
  }

  .selected-transaction {
    position: relative;
    border: 2px dotted ${colors.SELECTED_BORDER};
    height: 40px;
    width: 40px;
    border-radius: 50%;
    top: 5px;
  }

`;

ReactDOM.render(
  <React.StrictMode>
    <GlobalStyle />
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
