import React from "react";
import * as ReactD3Graph from "react-d3-graph";
import styled from "styled-components";
import { useQuery } from "react-query";
import tw from "twin.macro";

import { Graph, Node, CombinedEdge } from "./types";

type ServiceGraphNode = ReactD3Graph.GraphNode & Node;
type ServiceGraphLink = ReactD3Graph.GraphLink & CombinedEdge;

type DetailsPayload =
  | {
      type: "node";
      payload: Node;
    }
  | {
      type: "edge";
      payload: CombinedEdge;
      source: Node | undefined;
      destination: Node | undefined;
    };

// the graph configuration, just override the ones you need
const myConfig = {
  directed: true,
  automaticRearrangeAfterDropNode: true,
  nodeHighlightBehavior: true,
  highlightDegree: 2,
  highlightOpacity: 0.4,
  linkHighlightBehavior: true,
  node: {
    color: "#82c91e",
    size: 240,
    highlightStrokeColor: "#2b8a3e",
    labelProperty: "name",
    fontColor: "black",
    fontSize: 12,
  },
  link: {
    color: "#adb5bd",
    highlightColor: "#343a40",
    strokeWidth: 1.5,
  },
  d3: {
    alphaTarget: 0.05,
    gravity: -250,
    linkLength: 120,
    linkStrength: 2,
    disableLinkForce: false,
  },
};

function fetchServiceGraph(): Promise<Graph> {
  return fetch("http://127.0.0.1:8000/query", {
    method: "POST",
    mode: "cors",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      project_id: 1,
    }),
  }).then((res) => res.json());
}

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
  const [details, setDetails] = React.useState<DetailsPayload | undefined>(
    undefined
  );
  // Fetch service graph data
  //   const queryClient = useQueryClient();
  const { isLoading, error, data } = useQuery(
    "serviceGraph",
    fetchServiceGraph,
    {
      // Refetch the data every second
      refetchInterval: 1000,
    }
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

  const processedData = processServiceGraphData(data);

  const fetchNodeById = (nodeId: string) => {
    return processedData.nodes.find((node) => node.id === nodeId);
  };

  const onClickNode = function (nodeId: string) {
    console.log(`Clicked node ${nodeId}`);

    const results = fetchNodeById(nodeId);

    if (!results) {
      return;
    }

    setDetails({
      type: "node",
      payload: results,
    });
  };

  const onClickLink = function (source: string, target: string) {
    console.log(`Clicked link between ${source} and ${target}`);

    const results = processedData.links.find(
      (edge) => edge.source === source && edge.target === target
    );

    if (!results) {
      return;
    }

    setDetails({
      type: "edge",
      payload: results,
      source: fetchNodeById(results.from_node_id),
      destination: fetchNodeById(results.to_node_id),
    });
  };

  return (
    <React.Fragment>
      <Container>
        <ReactD3Graph.Graph
          key="service-graph"
          id="service-graph"
          data={processedData}
          config={myConfig as any}
          onClickNode={onClickNode}
          onClickLink={onClickLink}
        />
      </Container>
      <DetailsPanel>
        <Details details={details} />
      </DetailsPanel>
    </React.Fragment>
  );
}

function NodeDetails({ node }: { node: Node | undefined }) {
  if (!node) {
    return null;
  }
  return (
    <div>
      <div>Name: {node.name}</div>
      <div>Node Id: {node.node_id}</div>
      <div>Type: {node.node_type}</div>
    </div>
  );
}

function Details(props: { details: DetailsPayload | undefined }) {
  const { details } = props;

  if (!details) {
    return (
      <div>
        <i>Click on a node or edge view its details.</i>
      </div>
    );
  }

  if (details.type === "node") {
    const node = details.payload;
    return <NodeDetails node={node} />;
  }

  const edge = details.payload;
  const { source, destination } = details;
  return (
    <div className="grid grid-cols-1">
      <strong>Source</strong>
      <NodeDetails node={source} />
      <hr />
      <strong>Destination</strong>
      <NodeDetails node={destination} />
      <hr />
      <div>Status: {edge.status_ok}</div>
      <div>Expected Error: {edge.status_expected_error}</div>
      <div>Unexpected Error: {edge.status_unexpected_error}</div>
    </div>
  );
}

const Container = styled.div`
  ${tw`rounded shadow-lg bg-white`};
`;

const DetailsPanel = styled.div`
  width: 800px;
  ${tw`rounded bg-white mt-4 p-4`};
`;

export default ServiceGraph;
