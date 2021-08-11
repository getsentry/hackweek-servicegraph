import React from "react";
import cytoscape from "cytoscape";
// @ts-expect-error
import fcose from "cytoscape-fcose";
import * as ReactD3Graph from "react-d3-graph";
import styled from "styled-components";
import { useQuery } from "react-query";
import tw from "twin.macro";

import { Graph, Node, CombinedEdge } from "./types";
import useWindowSize from "./useWindowSize";

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
  return fetch("http://127.0.0.1:8000/graph", {
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
  const windowSize = useWindowSize();

  const serviceGraphContainerElement = React.useRef<HTMLDivElement>(null);
  const graph = React.useRef<cytoscape.Core>();

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
      // refetchInterval: 1000,
    }
  );

  React.useEffect(() => {
    if (!serviceGraphContainerElement.current) {
      return;
    }

    try {
      if (!graph.current || graph.current.destroyed()) {
        if (graph.current?.destroyed()) {
          console.log("graph destroyed; recreating");
        }
        cytoscape.use(fcose);

        let nodes: cytoscape.NodeDefinition[] = [];
        let edges: cytoscape.EdgeDefinition[] = [];

        if (data) {
          nodes = data.nodes.map((node): cytoscape.NodeDefinition => {
            return {
              data: {
                ...node,
                id: node.node_id,
                parent: node.parent_id,
              },
            };
          });

          edges = data.edges.map((edge): cytoscape.EdgeDefinition => {
            return {
              data: {
                ...edge,
                source: edge.from_node_id,
                target: edge.to_node_id,
              },
            };
          });
        }

        graph.current = cytoscape({
          // @ts-expect-error
          ready: function () {
            const core = this as unknown as cytoscape.Core;
            if (!core) {
              return;
            }
            core
              .layout({
                name: "fcose",
                idealEdgeLength: () => 200,
              } as any)
              .run();
          },
          elements: {
            nodes: [
              ...nodes,
              // { data: { id: "n1" } },
              // { data: { id: "n2" } },
              // { data: { id: "n3", parent: "n8" } },
              // { data: { id: "n5" } },
              // { data: { id: "n6", parent: "n8" } },
              // { data: { id: "n7", parent: "n8" } },
              // { data: { id: "n8" } },
              // { data: { id: "f1" } },
              // { data: { id: "f2" } },
              // { data: { id: "f3", parent: "n8" } },
            ],
            edges: [
              ...edges,
              // { data: { source: "n1", target: "f1" } },
              // { data: { source: "n1", target: "n3" } },
              // { data: { source: "f1", target: "n2" } },
              // { data: { source: "f1", target: "n3" } },
              // { data: { source: "n3", target: "f2" } },
              // { data: { source: "f2", target: "n5" } },
              // { data: { source: "n5", target: "n8" } },
              // { data: { source: "n6", target: "n3" } },
              // { data: { source: "n6", target: "n7" } },
              // { data: { source: "n6", target: "f3" } },
            ],
          },
          minZoom: 0.3,
          maxZoom: 1,
          style: [
            {
              selector: "node",
              style: {
                "background-color": "#bdd3d4",
                label: "data(name)",
                "text-valign": "bottom",
                "background-opacity": 0.7,
              },
            },

            {
              selector: ":parent",
              style: {
                //      'background-opacity': 0.333,
                "background-color": "#e8e8e8",
                "border-color": "#DADADA",
                //      'border-width': 3,
                "text-valign": "bottom",
              },
            },

            {
              selector: "edge",
              style: {
                "curve-style": "straight",
                "line-color": "#bdd3d4",
                "target-arrow-shape": "triangle",
              },
            },

            {
              selector: "node:selected",
              style: {
                "background-color": "#33ff00",
                "border-color": "#22ee00",
              },
            },

            {
              selector: "node.fixed",
              style: {
                shape: "diamond",
                "background-color": "#9D9696",
              },
            },

            {
              selector: "node.fixed:selected",
              style: {
                "background-color": "#33ff00",
              },
            },

            {
              selector: "node.alignment",
              style: {
                shape: "round-heptagon",
                "background-color": "#fef2d1",
              },
            },

            {
              selector: "node.alignment:selected",
              style: {
                "background-color": "#33ff00",
              },
            },

            {
              selector: "node.relative",
              style: {
                shape: "rectangle",
                "background-color": "#fed3d1",
              },
            },

            {
              selector: "node.relative:selected",
              style: {
                "background-color": "#33ff00",
              },
            },

            {
              selector: "edge:selected",
              style: {
                "line-color": "#33ff00",
              },
            },
          ],
          // wheelSensitivity: 0.2,
          container: serviceGraphContainerElement.current,
        });
      }
    } catch (error) {
      console.error(error);
    }

    return () => {
      graph.current && graph.current.destroy();
    };
  }, [data, error, isLoading]);

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
      <Container ref={serviceGraphContainerElement} />
      <Container style={{ display: "none" }}>
        <ReactD3Graph.Graph
          key="service-graph"
          id="service-graph"
          data={processedData}
          config={
            {
              ...myConfig,
              width: Math.max(windowSize.width ?? 800, 800),
              height: Math.max((windowSize.height ?? 400) - 200, 400),
            } as any
          }
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
  width: 100vw;
  height: 70vh;
  outline: 1px solid red;
`;

const DetailsPanel = styled.div`
  width: 800px;
  ${tw`rounded bg-white mt-4 p-4`};
`;

export default ServiceGraph;
