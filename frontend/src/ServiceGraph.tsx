import React from "react";
import styled from "styled-components";
import { ErrorBoundary } from "react-error-boundary";
import { useQuery, QueryErrorResetBoundary } from "react-query";
import cytoscape from "cytoscape";
// @ts-expect-error
import cytoscapeCola from "cytoscape-cola";
import tw from "twin.macro";
import _ from "lodash";

import { Uuid, Graph, Node, CombinedEdge } from "./types";

// https://github.com/cytoscape/cytoscape.js-navigator
const cytoscapeNavigator = require("cytoscape-navigator");
require("cytoscape-navigator/cytoscape.js-navigator.css");

try {
  cytoscape.use(cytoscapeCola);
  cytoscapeNavigator(cytoscape);
} catch (_) {
  // catch navigator already registered error on hot reload
}

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

function isUnhealthy(
  ok: number,
  expectedError: number,
  unexpectedError: number
): boolean {
  const expectedErrorThreshold = 0.99;
  const unexpectedErrorThreshold = 0.9999;

  if (ok === 0 && expectedError === 0 && unexpectedError === 0) {
    return false;
  }

  if (ok === 0) {
    return true;
  }

  if (ok / (ok + expectedError) < expectedErrorThreshold) {
    return true;
  }

  if (ok / (ok + unexpectedError) < unexpectedErrorThreshold) {
    return true;
  }

  return false;
}

// Convert service graph data into the format that cytoscape lib can consume
function processServiceGraphData(serviceGraphData: Graph) {
  const nodes = serviceGraphData.nodes.map((node): cytoscape.NodeDefinition => {
    return {
      data: {
        ...node,
        id: node.node_id,
        parent: node.parent_id,
      },
    };
  });

  const edges = serviceGraphData.edges.map((edge): cytoscape.EdgeDefinition => {
    return {
      data: {
        ...edge,
        source: edge.from_node_id,
        target: edge.to_node_id,
        group: isUnhealthy(
          edge.status_ok,
          edge.status_expected_error,
          edge.status_unexpected_error
        )
          ? "unhealthy"
          : null,
      },
    };
  });

  return {
    nodes,
    edges,
  };
}

function ServiceGraphOld() {
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

    let minimap: any = undefined;

    try {
      if (!graph.current || graph.current.destroyed()) {
        if (graph.current?.destroyed()) {
          console.log("graph destroyed; recreating");
        }
        cytoscape.use(cytoscapeCola);

        let nodes: cytoscape.NodeDefinition[] = [];
        let edges: cytoscape.EdgeDefinition[] = [];

        if (data) {
          const results = processServiceGraphData(data);
          nodes = results.nodes;
          edges = results.edges;
        }

        graph.current = cytoscape({
          // @ts-expect-error
          ready: function () {
            const core = this as unknown as cytoscape.Core;
            if (!core) {
              return;
            }
            // core
            //   .layout({
            //     name: "cola",
            //     nodeSpacing: function () {
            //       return 50;
            //     },
            //     // flow: { axis: "x", minSeparation: 300 },
            //     // idealEdgeLength: () => 200,
            //     // fit: false,
            //   } as any)
            //   .run();
          },
          layout: {
            name: "cola",
            nodeSpacing: function () {
              return 100;
            },
            flow: { axis: "y", minSeparation: 100 },
            fit: false,
          } as any,
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
                "line-color": "#bdd3d4",
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
              },
            },
            {
              selector: 'edge[group="unhealthy"]',
              style: {
                "line-color": "#ff0000",
                "target-arrow-color": "#ff0000",
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
                "target-arrow-color": "#33ff00",
              },
            },
          ],
          // wheelSensitivity: 0.2,
          container: serviceGraphContainerElement.current,
        });

        // @ts-expect-error
        minimap = graph.current.navigator();

        const fetchNodeById = (nodeId: string) => {
          return data?.nodes.find((node: Node) => node.node_id === nodeId);
        };

        graph.current.on("tap", function (evt) {
          if (evt.target === graph.current) {
            setDetails(undefined);
          }
        });

        graph.current.on("tap", "node", function (evt) {
          const node = evt.target;

          const result = fetchNodeById(node.id());

          if (result) {
            setDetails({
              type: "node",
              payload: result,
            });
          }
        });

        graph.current.on("tap", "edge", function (evt) {
          const edge = evt.target as cytoscape.EdgeSingularTraversing;

          const result = data?.edges.find(
            (data) =>
              data.from_node_id === edge.source().id() &&
              data.to_node_id === edge.target().id()
          );

          if (result) {
            setDetails({
              type: "edge",
              payload: result,
              source: fetchNodeById(result.from_node_id),
              destination: fetchNodeById(result.to_node_id),
            });
          }
        });
      }
    } catch (error) {
      console.error(error);
    }

    return () => {
      if (graph.current) {
        graph.current.destroy();
      }

      if (minimap) {
        minimap.destroy();
      }
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

  return (
    <React.Fragment>
      <Container ref={serviceGraphContainerElement} />
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
        <i>
          Click on a node (service / transaction) or edge to view its details.
        </i>
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
  ${tw`bg-white flex min-h-screen justify-center items-center content-center`};
  position: absolute;
  width: 100vw;
  height: 100vh;
`;

const DetailsPanel = styled.div`
  width: 500px;
  ${tw`rounded bg-gray-100 p-4`};
  position: absolute;
  top: 8px;
  left: 8px;
`;

const ButtonLink = styled.a`
  ${tw`whitespace-nowrap inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700`};
`;

// TODO: remove
// function isNodeEqual(current: Node, other: Node): boolean {
//   return current.node_id === other.node_id;
// }

function getEdgeKey(edge: CombinedEdge): string {
  return `${edge.from_node_id}:${edge.to_node_id}`;
}

function nodeToCytoscape(node: Node): cytoscape.NodeDefinition {
  return {
    data: {
      ...node,
      id: node.node_id,
      parent: node.parent_id,
    },
  };
}

function edgeToCytoscape(edge: CombinedEdge): cytoscape.EdgeDefinition {
  return {
    data: {
      ...edge,
      source: edge.from_node_id,
      target: edge.to_node_id,
      group: isUnhealthy(
        edge.status_ok,
        edge.status_expected_error,
        edge.status_unexpected_error
      )
        ? "unhealthy"
        : null,
    },
  };
}

type Props = {
  data: Graph;
};

type GraphReference = {
  nodes: Set<string>;
  edges: Set<string>;
};

type State = {
  nodes: Map<Uuid, Node>;
  edges: Map<string, CombinedEdge>;

  staging: {
    add: GraphReference;
    remove: GraphReference;
  };
  committed: GraphReference;
};

class ServiceGraphView extends React.Component<Props, State> {
  state: State = {
    nodes: new Map(),
    edges: new Map(),
    staging: {
      add: {
        nodes: new Set(),
        edges: new Set(),
      },
      remove: {
        nodes: new Set(),
        edges: new Set(),
      },
    },
    committed: {
      nodes: new Set(),
      edges: new Set(),
    },
  };

  serviceGraphContainerElement = React.createRef<HTMLDivElement>();
  graph: cytoscape.Core | undefined = undefined;
  minimap: any = undefined;

  static getDerivedStateFromProps(props: Props, prevState: State): State {
    const { data } = props;

    console.log("data", data);

    const nodesMap: Map<Uuid, Node> = new Map();
    const edgesMap: Map<string, CombinedEdge> = new Map();

    const staging: State["staging"] = {
      add: {
        nodes: new Set(),
        edges: new Set(),
      },
      remove: {
        nodes: new Set(),
        edges: new Set(),
      },
    };

    // add any new nodes and mark stale nodes to be removed from the cytoscape graph

    data.nodes.forEach((node) => {
      // update nodes dictionary with latest node information
      nodesMap.set(node.node_id, node);

      // assume node is new; if it is not new, then it'll be removed from staging
      // when prevState.committed.nodes is traversed
      staging.add.nodes.add(node.node_id);
    });

    prevState.committed.nodes.forEach((node_id) => {
      if (!staging.add.nodes.has(node_id)) {
        // mark this node to be removed
        staging.remove.nodes.add(node_id);
        return;
      }

      // node is already on the graph; remove it from staging
      staging.add.nodes.delete(node_id);
    });

    // add any new edges and mark stale edges to be removed from the cytoscape graph

    data.edges.forEach((edge) => {
      const edgeKey = getEdgeKey(edge);
      // update edges dictionary with latest edge information
      edgesMap.set(edgeKey, edge);

      // assume edge is new; if it is not new, then it'll be removed from staging
      // when prevState.committed.edges is traversed
      staging.add.edges.add(edgeKey);
    });

    prevState.committed.edges.forEach((edge_key) => {
      if (!staging.add.edges.has(edge_key)) {
        // mark this edge to be removed
        staging.remove.edges.add(edge_key);
        return;
      }

      // edge is already on the graph; remove it from staging
      staging.add.edges.delete(edge_key);
    });

    return {
      ...prevState,
      staging,
      nodes: nodesMap,
      edges: edgesMap,
    };
  }

  shouldComponentUpdate(nextProps: Props) {
    return _.isEqual(this.props, nextProps);
  }

  componentDidMount() {
    if (!this.serviceGraphContainerElement.current) {
      return;
    }

    try {
      if (!(!this.graph || this.graph.destroyed())) {
        return;
      }

      const nodes: cytoscape.NodeDefinition[] = [];
      const edges: cytoscape.EdgeDefinition[] = [];

      console.log("this.state", this.state);

      this.state.staging.add.nodes.forEach((node_id) => {
        const node = this.state.nodes.get(node_id);
        if (node) {
          nodes.push(nodeToCytoscape(node));
        } else {
          throw Error(`unable to find node: ${node_id}`);
        }
      });

      this.state.staging.add.edges.forEach((edge_key) => {
        const edge = this.state.edges.get(edge_key);
        if (edge) {
          edges.push(edgeToCytoscape(edge));
        } else {
          throw Error(`unable to find edge: ${edge_key}`);
        }
      });

      this.graph = cytoscape({
        layout: {
          name: "cola",
          nodeSpacing: function () {
            return 100;
          },
          flow: { axis: "y", minSeparation: 100 },
          fit: false,
        } as any,
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
              "background-color": "#e8e8e8",
              "border-color": "#DADADA",
              "text-valign": "bottom",
            },
          },
          {
            selector: "edge",
            style: {
              "line-color": "#bdd3d4",
              "curve-style": "bezier",
              "target-arrow-shape": "triangle",
            },
          },
          {
            selector: 'edge[group="unhealthy"]',
            style: {
              "line-color": "#ff0000",
              "target-arrow-color": "#ff0000",
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
              "target-arrow-color": "#33ff00",
            },
          },
        ],
        elements: {
          nodes,
          edges,
        },
        container: this.serviceGraphContainerElement.current,
      });

      // @ts-expect-error
      this.minimap = this.graph.navigator();
    } catch (error) {
      console.error(error);
    }
  }

  componentWillUnmount() {
    if (this.graph) {
      this.graph.destroy();
    }

    if (this.minimap) {
      this.minimap.destroy();
    }
  }

  render() {
    return <Container ref={this.serviceGraphContainerElement}>foo</Container>;
  }
}

function FetchData() {
  const { isLoading, error, data, refetch } = useQuery<Graph, Error>(
    "serviceGraph",
    fetchServiceGraph,
    {
      // Refetch the data every second
      // refetchInterval: 1000,
    }
  );

  if (isLoading) {
    return (
      <Container>
        <h1 className="text-3xl animate-pulse">Loading data</h1>
      </Container>
    );
  }

  if (error) {
    console.log("error", error);
    return (
      <Container>
        <div className="flex-col">
          <h1 className="text-3xl">Unable to load data</h1>
          <hr className="m-4" />
          <ButtonLink
            href="#try-again"
            onClick={(event) => {
              event.preventDefault();
              refetch();
            }}
          >
            Try again
          </ButtonLink>
          <hr className="m-4" />
          <pre>{error.message}</pre>
        </div>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container>
        <div className="flex-col">
          <h1 className="text-3xl">Empty data</h1>
          <hr className="m-4" />
          <ButtonLink
            href="#try-again"
            onClick={(event) => {
              event.preventDefault();
              refetch();
            }}
          >
            Try again
          </ButtonLink>
        </div>
      </Container>
    );
  }

  return <ServiceGraphView data={data} />;
}

function ServiceGraph() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <Container>
              <div className="flex-col">
                <h1 className="text-3xl">There was an error!</h1>
                <hr className="m-4" />
                <ButtonLink
                  href="#try-again"
                  onClick={(event) => {
                    event.preventDefault();
                    resetErrorBoundary();
                  }}
                >
                  Try again
                </ButtonLink>
              </div>
            </Container>
          )}
        >
          <FetchData />
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

export default ServiceGraph;
