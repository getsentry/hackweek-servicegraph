import React from "react";
import { Graph } from "react-d3-graph";
import styled from "styled-components";

// graph payload (with minimalist structure)
const data = {
  nodes: [{ id: "Harry" }, { id: "Sally" }, { id: "Alice" }],
  links: [
    { source: "Harry", target: "Sally" },
    { source: "Harry", target: "Alice" },
  ],
};

// the graph configuration, just override the ones you need
const myConfig = {
  nodeHighlightBehavior: true,
  node: {
    color: "lightgreen",
    size: 120,
    highlightStrokeColor: "blue",
  },
  link: {
    highlightColor: "lightblue",
  },
};

const onClickNode = function (nodeId: string) {
  console.log(`Clicked node ${nodeId}`);
};

const onClickLink = function (source: string, target: string) {
  console.log(`Clicked link between ${source} and ${target}`);
};

function ServiceGraph() {
  return (
    <Container>
      <Graph
        id="service-graph" // id is mandatory
        data={data}
        config={myConfig}
        onClickNode={onClickNode}
        onClickLink={onClickLink}
      />
    </Container>
  );
}

const Container = styled.div`
  outline: 1px solid red;
`;

export default ServiceGraph;
