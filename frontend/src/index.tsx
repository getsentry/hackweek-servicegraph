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
    ${tw`font-sans bg-gray-100`}
  }

  .cytoscape-navigatorOverlay {
    user-select: none !important;
  }

  .cytoscape-navigator {
    z-index: 100 !important;
  }

  .cloud-icon {
    height: 30px;
    width: 30px;
    background-image: url("cloud.svg");
    background-size: cover;
    background-repeat: no-repeat;
  }

  .selected-transaction {
    position: relative;
    border: 2px dotted ${colors.SELECTED_BORDER};
    height: 50px;
    width: 50px;
    border-radius: 50%;
    top: 10px;
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
