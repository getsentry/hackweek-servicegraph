import React from "react";
import ReactDOM from "react-dom";
import "./assets/styles.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

import { createGlobalStyle } from "styled-components";
import tw from "twin.macro";

const GlobalStyle = createGlobalStyle`
  body {
    ${tw`font-sans bg-gray-100`}
  }

  .cytoscape-navigatorOverlay {
    user-select: none !important;
  }

  .cytoscape-navigator {
    z-index: 100 !important;
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
