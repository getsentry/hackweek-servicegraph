import React from "react";
import styled from "styled-components";
import { ErrorBoundary } from "react-error-boundary";
import { useQuery, QueryErrorResetBoundary } from "react-query";
import cytoscape from "cytoscape";
// @ts-expect-error
import cytoscapeCola from "cytoscape-cola";
import tw from "twin.macro";
import _ from "lodash";
import invariant from "invariant";

import {
  Uuid,
  Graph,
  Node,
  CombinedEdge,
  NodeType,
  ActiveNodes,
  ServiceMapPayload,
  EdgeStatus,
} from "./types";

// https://github.com/cytoscape/cytoscape.js-navigator
const cytoscapeNavigator = require("cytoscape-navigator");
require("cytoscape-navigator/cytoscape.js-navigator.css");

function makeLayoutConfig() {
  return {
    name: "cola",
    nodeSpacing: function () {
      return 100;
    },
    flow: { axis: "y", minSeparation: 100 },
    fit: false,
  } as any;
}

try {
  cytoscape.use(cytoscapeCola);
  cytoscapeNavigator(cytoscape);
} catch (_) {
  // catch navigator already registered error on hot reload
}

type DetailsPayload =
  | {
      type: "node";
      payload: Uuid;
    }
  | {
      type: "edge";
      source: Uuid;
      destination: Uuid;
    };

const fetchServiceGraph =
  ({
    nodeSources,
    nodeTargets,
    edgeStatuses,
  }: {
    nodeSources: Set<NodeType>;
    nodeTargets: Set<NodeType>;
    edgeStatuses: Set<EdgeStatus>;
  }) =>
  (): Promise<ServiceMapPayload> => {
    return fetch("http://127.0.0.1:8000/service-map", {
      method: "POST",
      mode: "cors",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        project_id: 1,
        from_types: Array.from(nodeSources),
        to_types: Array.from(nodeTargets),
        edge_statuses: Array.from(edgeStatuses),
      }),
    }).then((res) => res.json());
  };

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

function NodeDetails({ node }: { node: Node | undefined }) {
  if (!node) {
    return null;
  }
  return (
    <div>
      <div>Name: {node.name}</div>
      <div>Node Id: {node.node_id}</div>
      <div>Type: {node.node_type}</div>
      <div>Ok: {node.status_ok}</div>
      <div>Expected error: {node.status_expected_error}</div>
      <div>Unexpected error: {node.status_unexpected_error}</div>
    </div>
  );
}

type DetailsPayloadDereferenced =
  | {
      type: "node";
      payload: Node;
    }
  | {
      type: "edge";
      payload: CombinedEdge;
      source: Node;
      destination: Node;
    };

function Details(props: { details: DetailsPayloadDereferenced | undefined }) {
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
      <div>OK: {edge.status_ok}</div>
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
const ToggleLink = styled.a<{ toggleOn: boolean }>`
  ${tw`whitespace-nowrap inline-flex items-center justify-center px-1 py-1 border rounded-md shadow-sm text-xs font-medium text-white `};

  ${(p) => {
    if (p.toggleOn) {
      return tw`border-transparent bg-blue-600 hover:bg-blue-700`;
    }

    return tw`bg-white text-blue-700 border-blue-700 hover:bg-blue-100`;
  }}
`;

function getEdgeKeyWithSourceTarget(source: string, target: string): string {
  return `${source}:${target}`;
}

function getEdgeKey(edge: CombinedEdge): string {
  return getEdgeKeyWithSourceTarget(edge.from_node_id, edge.to_node_id);
}

function nodeToCytoscape(node: Node): cytoscape.NodeDefinition {
  return {
    data: {
      ...node,
      id: node.node_id,
      parent: node.parent_id,
      group: isUnhealthy(
        node.status_ok,
        node.status_expected_error,
        node.status_unexpected_error
      )
        ? "unhealthy"
        : null,
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
  nodeSources: Set<NodeType>;
  toggleNodeSource: (nodeType: NodeType) => void;
  nodeTargets: Set<NodeType>;
  toggleNodeTarget: (nodeType: NodeType) => void;
  edgeStatuses: Set<EdgeStatus>;
  toggleEdgeStatuses: (status: EdgeStatus) => void;
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
    previousNodes: Map<Uuid, Node>;
    previousEdges: Map<string, CombinedEdge>;
  };
  committed: GraphReference;

  details: DetailsPayload | undefined;
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
      previousNodes: new Map(),
      previousEdges: new Map(),
    },
    committed: {
      nodes: new Set(),
      edges: new Set(),
    },
    details: undefined,
  };

  serviceGraphContainerElement = React.createRef<HTMLDivElement>();
  graph: cytoscape.Core | undefined = undefined;
  layout: cytoscape.Layouts | undefined = undefined;
  minimap: any = undefined;

  static getDerivedStateFromProps(props: Props, prevState: State): State {
    const { data } = props;

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
      previousNodes: new Map(prevState.nodes),
      previousEdges: new Map(prevState.edges),
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

    const hasNodesToAdd = staging.add.nodes.size > 0;
    const hasNodesToRemove = staging.remove.nodes.size > 0;
    const hasEdgesToAdd = staging.add.edges.size > 0;
    const hasEdgesToRemove = staging.remove.edges.size > 0;

    const hasChanges =
      hasNodesToAdd || hasNodesToRemove || hasEdgesToAdd || hasEdgesToRemove;

    if (hasChanges) {
      return {
        ...prevState,
        staging,
        nodes: nodesMap,
        edges: edgesMap,
      };
    }

    return prevState;
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    const propsNotEqual = !_.isEqual(this.props, nextProps);
    const stateNotEqual = !_.isEqual(this.state, nextState);
    return propsNotEqual || stateNotEqual;
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
        layout: makeLayoutConfig(),
        minZoom: 0.3,
        maxZoom: 1,
        style: [
          {
            selector: "node",
            style: {
              "background-color": "#1864ab",
              label: "data(name)",
              "text-valign": "bottom",
              "background-opacity": 0.9,
            },
          },

          {
            selector: ":parent",
            style: {
              "background-color": "#d0ebff",
              "border-color": "#1864ab",
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
              "line-color": "#ffbdb4",
              "target-arrow-color": "#ffbdb4",
            },
          },
          {
            selector: 'node[group="unhealthy"]',
            style: {
              "border-width": 2,
              "border-color": "#ff0000",
            },
          },
          {
            selector: "node:selected",
            style: {
              "background-color": "#33ff00",
              "border-color": "#22ee00",
              "background-opacity": 0.7,
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

      this.graph.on("tap", (event) => {
        if (event.target === this.graph) {
          this.setState({
            details: undefined,
          });
        }
      });

      this.graph.on("tap", "node", (event) => {
        const node = event.target as cytoscape.SingularData;

        this.setState({
          details: {
            type: "node",
            payload: node.id(),
          },
        });
      });

      this.graph.on("tap", "edge", (event) => {
        const edge = event.target as cytoscape.EdgeSingularTraversing;

        this.setState({
          details: {
            type: "edge",
            source: edge.source().id(),
            destination: edge.target().id(),
          },
        });
      });

      const committed = {
        nodes: new Set(this.state.staging.add.nodes),
        edges: new Set(this.state.staging.add.edges),
      };

      committed.nodes.forEach((node_id) => {
        invariant(
          !this.graph?.nodes(`[id = '${node_id}']`).empty(),
          `componentDidMount: expect node to exist in cytoscape graph: ${node_id}`
        );
      });

      committed.edges.forEach((edge_key) => {
        const edge = this.state.edges.get(edge_key);
        if (edge) {
          const cytoscapeEdge = edgeToCytoscape(edge);
          invariant(
            !this.graph
              ?.elements(
                `edge[source = '${cytoscapeEdge.data.source}'][target = '${cytoscapeEdge.data.target}']`
              )
              .empty(),
            `expect edge to exist in cytoscape graph: ${edge}`
          );
        } else {
          invariant(false, `expected edge: ${edge_key}`);
        }
      });
      console.log("componentDidMount - commit");
      this.setState({
        staging: {
          // ...this.state.staging,
          add: {
            nodes: new Set(),
            edges: new Set(),
          },
          remove: {
            nodes: new Set(),
            edges: new Set(),
          },
          previousEdges: new Map(this.state.edges),
          previousNodes: new Map(this.state.nodes),
        },
        committed,
      });
    } catch (error) {
      console.error(error);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    this.state.committed.nodes.forEach((node_id) => {
      invariant(
        !this.graph?.nodes(`[id = '${node_id}']`).empty(),
        `componentDidUpdate: expect node to exist in cytoscape graph: ${node_id}`
      );
    });

    this.state.committed.edges.forEach((edge_key) => {
      const edge = this.state.staging.previousEdges.get(edge_key);
      if (edge) {
        const cytoscapeEdge = edgeToCytoscape(edge);
        invariant(
          !this.graph
            ?.elements(
              `edge[source = '${cytoscapeEdge.data.source}'][target = '${cytoscapeEdge.data.target}']`
            )
            .empty(),
          `expect edge to exist in cytoscape graph: ${edge}`
        );
      } else {
        console.log(
          "this.state.staging.previousEdges",
          this.state.staging.previousEdges
        );
        console.log("this.state.edges", this.state.edges);
        console.log("this.state.committed.edges", this.state.committed.edges);
        invariant(false, `expect edge: ${edge_key}`);
      }
    });

    const hasNodesToAdd = this.state.staging.add.nodes.size > 0;
    const hasNodesToRemove = this.state.staging.remove.nodes.size > 0;
    const hasEdgesToAdd = this.state.staging.add.edges.size > 0;
    const hasEdgesToRemove = this.state.staging.remove.edges.size > 0;

    const hasChanges =
      hasNodesToAdd || hasNodesToRemove || hasEdgesToAdd || hasEdgesToRemove;

    if (this.graph && hasChanges) {
      if (this.layout) {
        this.layout.stop();
      }

      const committed = {
        nodes: new Set(this.state.committed.nodes),
        edges: new Set(this.state.committed.edges),
      };

      // Removal of any nodes that are parents (i.e. has children) will also delete their children.
      // We set parents of nodes to be removed to be null, and the parents of their children to be null.
      this.state.staging.remove.nodes.forEach((node_id) => {
        this.graph?.nodes(`[id = '${node_id}']`).move({ parent: null });
        this.graph?.nodes(`[parent = '${node_id}']`).move({ parent: null });
      });

      this.state.staging.remove.nodes.forEach((node_id) => {
        if (!committed.nodes.has(node_id)) {
          throw Error(`expect node to exist in committed graph: ${node_id}`);
        }
        if (this.graph?.nodes(`[id = '${node_id}']`).empty()) {
          throw Error(
            `componentDidUpdate: expect node to exist in cytoscape graph: ${node_id}`
          );
        }

        const prevLength = this.graph?.nodes().toArray().length ?? 0;

        // console.log("graph nodes (before delete)", prevLength);
        committed.nodes.delete(node_id);

        // console.log(
        //   `number of ${node_id} nodes`,
        //   this.graph?.nodes(`[id = '${node_id}']`).toArray().length
        // );

        // console.log(
        //   "num of children for ",
        //   node_id,
        //   this.graph?.nodes(`[parent = '${node_id}']`).toArray().length
        // );

        // console.log(
        //   "deleting",
        //   node_id,
        //   this.state.staging.previousNodes.get(node_id)
        // );
        this.graph?.remove(`node[id = '${node_id}']`);

        const afterLength = this.graph?.nodes().toArray().length ?? 0;
        // console.log("graph nodes (after delete)", afterLength);

        invariant(
          prevLength - afterLength === 1,
          "expected removal of only one node"
        );
      });

      this.state.staging.add.nodes.forEach((node_id) => {
        const node = this.state.nodes.get(node_id);
        if (node) {
          committed.nodes.add(node_id);
          this.graph?.add(nodeToCytoscape(node));
        } else {
          throw Error(`unable to find node: ${node_id}`);
        }
      });

      this.state.staging.add.edges.forEach((edge_key) => {
        const edge = this.state.edges.get(edge_key);
        if (edge) {
          committed.edges.add(edge_key);
          this.graph?.add(edgeToCytoscape(edge));
        } else {
          throw Error(`unable to find edge: ${edge_key}`);
        }
      });

      this.state.staging.remove.edges.forEach((edge_key) => {
        const edge = this.state.staging.previousEdges.get(edge_key);
        if (edge) {
          committed.edges.delete(getEdgeKey(edge));
          const cytoscapeEdge = edgeToCytoscape(edge);
          this.graph?.remove(
            `edge[source = '${cytoscapeEdge.data.source}'][target = '${cytoscapeEdge.data.target}']`
          );
        } else {
          throw Error(`unable to find edge: ${edge_key}`);
        }
      });

      this.state.nodes.forEach((node) => {
        if (this.graph?.nodes(`[id = '${node.node_id}']`).empty()) {
          this.graph?.add(nodeToCytoscape(node));
        }

        if (node.parent_id) {
          this.graph
            ?.nodes(`[id = '${node.node_id}']`)
            .move({ parent: node.parent_id });
        }
      });

      this.state.edges.forEach((edge) => {
        if (!this.state.nodes.has(edge.from_node_id)) {
          invariant(false, `source node does not exist ${edge.from_node_id}`);
        }

        const selector = `edge[source = '${edge.from_node_id}'][target = '${edge.to_node_id}']`;

        if (this.graph?.elements(selector).empty()) {
          this.graph?.add(edgeToCytoscape(edge));
          console.log("repair");
        }
      });

      this.layout = this.graph.elements().makeLayout(makeLayoutConfig());
      this.layout.run();

      console.log("componentDidUpdate - commit");
      this.setState({
        staging: {
          // ...this.state.staging,
          add: {
            nodes: new Set(),
            edges: new Set(),
          },
          remove: {
            nodes: new Set(),
            edges: new Set(),
          },
          previousEdges: new Map(this.state.edges),
          previousNodes: new Map(this.state.nodes),
        },
        committed,
      });
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

  getDetails = (): DetailsPayloadDereferenced | undefined => {
    if (!this.state.details) {
      return undefined;
    }

    if (this.state.details.type === "node") {
      const node = this.state.nodes.get(this.state.details.payload);
      if (node) {
        return {
          type: "node",
          payload: node,
        };
      }
    }

    if (this.state.details.type === "edge") {
      const { source, destination } = this.state.details;
      const edge = this.state.edges.get(
        getEdgeKeyWithSourceTarget(source, destination)
      );

      const sourceNode = this.state.nodes.get(source);
      const destinationNode = this.state.nodes.get(destination);

      if (edge && sourceNode && destinationNode) {
        return {
          type: "edge",
          payload: edge,
          source: sourceNode,
          destination: destinationNode,
        };
      }
    }

    return undefined;
  };

  render() {
    const {
      toggleNodeSource,
      nodeSources,
      toggleNodeTarget,
      nodeTargets,
      edgeStatuses,
      toggleEdgeStatuses,
    } = this.props;

    return (
      <React.Fragment>
        <Container ref={this.serviceGraphContainerElement} />
        <DetailsPanel>
          <Details details={this.getDetails()} />
        </DetailsPanel>
        <Controls>
          <div className="grid grid-flow-col auto-cols-min gap-2 items-center">
            <div>
              <strong>Nodes</strong>
            </div>
          </div>
          <div className="mt-2 grid grid-flow-col auto-cols-min gap-2 items-center">
            <div>
              <strong>Source</strong>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={nodeSources.has("transaction")}
                onClick={(event) => {
                  event.preventDefault();
                  toggleNodeSource("transaction");
                }}
              >
                Transactions
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={nodeSources.has("service")}
                onClick={(event) => {
                  event.preventDefault();
                  toggleNodeSource("service");
                }}
              >
                Services
              </ToggleLink>
            </div>
            <div>
              <strong>Target</strong>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={nodeTargets.has("transaction")}
                onClick={(event) => {
                  event.preventDefault();
                  toggleNodeTarget("transaction");
                }}
              >
                Transactions
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={nodeTargets.has("service")}
                onClick={(event) => {
                  event.preventDefault();
                  toggleNodeTarget("service");
                }}
              >
                Services
              </ToggleLink>
            </div>
          </div>

          <div className="mt-2 grid grid-flow-col auto-cols-min gap-2 items-center">
            <div>
              <strong>Status</strong>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={edgeStatuses.has("ok")}
                onClick={(event) => {
                  event.preventDefault();
                  toggleEdgeStatuses("ok");
                }}
              >
                Ok
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={edgeStatuses.has("expected_error")}
                onClick={(event) => {
                  event.preventDefault();
                  toggleEdgeStatuses("expected_error");
                }}
              >
                Expected Error (400s)
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={edgeStatuses.has("unexpected_error")}
                onClick={(event) => {
                  event.preventDefault();
                  toggleEdgeStatuses("unexpected_error");
                }}
              >
                Un-expected Error (500s)
              </ToggleLink>
            </div>
          </div>
        </Controls>
      </React.Fragment>
    );
  }
}

const Controls = styled.div`
  width: 500px;
  ${tw`rounded bg-gray-100 p-4`};
  position: absolute;
  top: 8px;
  right: 8px;
`;

function FetchData() {
  const [edgeStatuses, setEdgeStatuses] = React.useState<Set<EdgeStatus>>(
    new Set([] as EdgeStatus[])
  );

  const toggleEdgeStatuses = (status: EdgeStatus) => {
    setEdgeStatuses((prevState) => {
      const nextState = new Set(prevState);
      if (prevState.has(status)) {
        nextState.delete(status);
      } else {
        nextState.add(status);
      }

      return nextState;
    });
  };

  const [nodeSources, setNodeSources] = React.useState<Set<NodeType>>(
    new Set([] as NodeType[])
  );

  const toggleNodeSource = (nodeType: NodeType) => {
    setNodeSources((prevState) => {
      const nextState = new Set(prevState);
      if (prevState.has(nodeType)) {
        nextState.delete(nodeType);
      } else {
        nextState.add(nodeType);
      }

      // if (nextState.size === 0) {
      //   return new Set(["transaction", "service"] as NodeType[]);
      // }

      return nextState;
    });
  };

  const [nodeTargets, setNodeTargets] = React.useState<Set<NodeType>>(
    new Set([] as NodeType[])
  );

  const toggleNodeTarget = (nodeType: NodeType) => {
    setNodeTargets((prevState) => {
      const nextState = new Set(prevState);
      if (prevState.has(nodeType)) {
        nextState.delete(nodeType);
      } else {
        nextState.add(nodeType);
      }

      // if (nextState.size === 0) {
      //   return new Set(["transaction", "service"] as NodeType[]);
      // }

      return nextState;
    });
  };

  const { isLoading, error, data, refetch } = useQuery<
    ServiceMapPayload,
    Error
  >(
    "serviceGraph",
    fetchServiceGraph({ nodeSources, nodeTargets, edgeStatuses }),
    {
      // Refetch the data every second
      refetchInterval: 1000,
    }
  );

  console.log("data", data);
  // const activeNodesQuery = useQuery('activeNodes', fetchActiveNodes());

  if (isLoading) {
    return (
      <Container>
        <h1 className="text-3xl animate-pulse">Loading data</h1>
      </Container>
    );
  }

  if (error) {
    console.error("error", error);
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

  return (
    <ServiceGraphView
      data={data.graph}
      nodeSources={nodeSources}
      toggleNodeSource={toggleNodeSource}
      nodeTargets={nodeTargets}
      toggleNodeTarget={toggleNodeTarget}
      edgeStatuses={edgeStatuses}
      toggleEdgeStatuses={toggleEdgeStatuses}
    />
  );
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
