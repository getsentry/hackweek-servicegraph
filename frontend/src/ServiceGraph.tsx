import React from "react";
import * as ReactD3Graph from "react-d3-graph";
import styled from "styled-components";
import { useQuery } from "react-query";
import { Graph, Node, CombinedEdge } from "./types";

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

function fetchServiceGraph(): Promise<Graph> {
  return fetch("http://127.0.0.1:8000/query?project_id=1").then((res) =>
    res.json()
  );
}

type ServiceGraphNode = ReactD3Graph.GraphNode & Node;
type ServiceGraphLink = ReactD3Graph.GraphLink & CombinedEdge;

// Convert service graph data into the format that d3 graph lib can consume
function processServiceGraphData(
  serviceGraphData: Graph
): ReactD3Graph.GraphData<ServiceGraphNode, ServiceGraphLink> {
  const nodes: ServiceGraphNode[] = serviceGraphData.nodes.map((node) => {
    return {
      ...node,
      id: node.node_id,
    };
  });
  const links: ServiceGraphLink[] = serviceGraphData.edges.map((edge) => {
    return {
      ...edge,
      source: edge.from_node_id,
      target: edge.to_node_id,
    };
  });

  return {
    nodes,
    links,
  };
}

function ServiceGraph() {
  // Fetch service graph data
  //   const queryClient = useQueryClient();
  const { isLoading, error, data } = useQuery(
    "serviceGraph",
    fetchServiceGraph
  );

  if (isLoading) {
    return <Container>Loading</Container>;
  }

  if (error) {
    return (
      <Container>
        <p>{error as Error}</p>
        <pre>{JSON.stringify(error)}</pre>
      </Container>
    );
  }

  if (!data) {
    return <Container>No Service Graph Data.</Container>;
  }

  return (
    <Container>
      <ReactD3Graph.Graph
        key="service-graph"
        id="service-graph"
        data={processServiceGraphData(data)}
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
