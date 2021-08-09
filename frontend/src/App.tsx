import React from "react";

import styled from "styled-components";

const Component = styled.div`
  background: blue;
  color: red;
`;

function App() {
  return (
    <div className="App">
      <Component>foo</Component>
    </div>
  );
}

export default App;
