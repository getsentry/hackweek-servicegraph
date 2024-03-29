import React from "react";
import styled from "styled-components";
import { ErrorBoundary } from "react-error-boundary";
import { useQuery, QueryErrorResetBoundary } from "react-query";
import cytoscape from "cytoscape";
// // @ts-expect-error
// import cytoscapeCola from "cytoscape-cola";
// @ts-expect-error
import fcose from "cytoscape-fcose";
import tw from "twin.macro";
import _ from "lodash";
import invariant from "invariant";
import { useThrottle } from "@react-hook/throttle";
import {
  parseISO,
  isValid,
  subHours,
  isWithinInterval,
  format,
  formatDistanceToNow,
} from "date-fns";

import {
  Uuid,
  Graph,
  Node,
  CombinedEdge,
  NodeType,
  ServiceMapPayload,
  EdgeStatus,
  HistogramData,
  ActiveNodes,
  LastActivity,
} from "./types";

import colors from "./colors";

import RangeSliderComponent from "./RangeSliderComponent";

// https://github.com/cytoscape/cytoscape.js-navigator
const cytoscapeNavigator = require("cytoscape-navigator");
require("cytoscape-navigator/cytoscape.js-navigator.css");

const API_PATH =
  process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000/api" : "api";

const cytoscapeNodeHtmlLabel = require("cytoscape-node-html-label");

function makeLayoutConfig() {
  return {
    name: "fcose",
    fit: true,
    // randomize: true,
    // animationDuration: 1000,
    animate: false,
    // quality: "proof",
    nodeDimensionsIncludeLabels: true,
    packComponents: false,
    idealEdgeLength: () => 200,
    // gravity: 0,
    nodeRepulsion: () => 4500 * 1.5,
    // nestingFactor: 0,
    nodeSeparation: 150,
    tilingPaddingVertical: 50,
    tilingPaddingHorizontal: 50,
  };
  // return {
  //   name: "cola",
  //   nodeSpacing: function () {
  //     return 50;
  //   },
  //   flow: { axis: "y", minSeparation: 100 },
  //   fit: false,
  //   maxSimulationTime: 0,
  // } as any;
}

try {
  // cytoscape.use(cytoscapeCola);
  cytoscape.use(fcose);
  cytoscapeNavigator(cytoscape);
  cytoscapeNodeHtmlLabel(cytoscape);
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
    startDate,
    endDate,
    trafficVolumeFilter,
  }: {
    nodeSources: Set<NodeType>;
    nodeTargets: Set<NodeType>;
    edgeStatuses: Set<EdgeStatus>;
    startDate: Date | undefined;
    endDate: Date | undefined;
    trafficVolumeFilter: number;
  }) =>
  (): Promise<ServiceMapPayload> => {
    // console.log("startDate", startDate);
    // console.log("endDate", endDate);
    if (endDate) {
      const currentHour = new Date().getHours();
      if (endDate.getHours() === currentHour) {
        endDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
      }
    }
    return fetch(API_PATH + "/service-map", {
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
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
        traffic_volume: trafficVolumeFilter,
      }),
    }).then((res) => res.json());
  };

const fetchTimelineHistogram = (): Promise<any> => {
  return fetch(API_PATH + "/histogram", {
    method: "POST",
    mode: "cors",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      project_id: 1,
      start_date: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
    }),
  }).then((res) => res.json());
};

function isUnhealthy(
  ok: number,
  expectedError: number,
  unexpectedError: number
): boolean {
  const expectedErrorThreshold = 0.98;
  const unexpectedErrorThreshold = 0.99;

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

function NodeDetails({
  node,
  last_activity,
}: {
  node: Node | undefined;
  last_activity: LastActivity | undefined;
}) {
  if (!node) {
    return null;
  }

  let lastActivityDate = last_activity ? parseISO(last_activity) : undefined;
  let relativeDate = isValid(lastActivityDate)
    ? formatDistanceToNow(lastActivityDate as Date, { addSuffix: true })
    : "";

  return (
    <div>
      <div>Name: {node.name}</div>
      {
        //<div>Node Id: {node.node_id}</div>
        //<div>Parent Id: {node.parent_id ?? "none"}</div>
      }
      <div>Type: {node.node_type}</div>
      <div>Description: {node.description || "none"}</div>
      <div>Class: {node.class || "generic"}</div>
      <div>
        Last activity:{" "}
        {isValid(lastActivityDate)
          ? `${format(lastActivityDate as Date, "PPpp")} - ${relativeDate}`
          : "unknown"}
      </div>
      {/* buggy
      <div>✅ Ok: {node.status_ok}</div>
      <div>🛑 Expected error: {node.status_expected_error}</div>
      <div>🔥 Unexpected error: {node.status_unexpected_error}</div>
      */}
    </div>
  );
}

type DetailsPayloadDereferenced =
  | {
      type: "node";
      payload: Node;
      last_activity: LastActivity | undefined;
    }
  | {
      type: "edge";
      payload: CombinedEdge;
      source: { node: Node; last_activity: LastActivity | undefined };
      destination: { node: Node; last_activity: LastActivity | undefined };
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
    return <NodeDetails node={node} last_activity={details.last_activity} />;
  }

  const edge = details.payload;
  const { source, destination } = details;
  return (
    <div className="grid grid-cols-1">
      <strong>Edge</strong>
      <div>Description: {edge.description || "none"}</div>
      <div>Class: {edge.class || "generic"}</div>
      <div>✅ OK: {edge.status_ok}</div>
      <div>🛑 Expected Error: {edge.status_expected_error}</div>
      <div>🔥 Unexpected Error: {edge.status_unexpected_error}</div>
      <hr />
      <strong>Source</strong>
      <NodeDetails node={source.node} last_activity={source.last_activity} />
      <hr />
      <strong>Destination</strong>
      <NodeDetails
        node={destination.node}
        last_activity={destination.last_activity}
      />
    </div>
  );
}

const Container = styled.div`
  ${tw`bg-white flex min-h-screen justify-center items-center content-center`};
  position: absolute;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
`;

const DetailsPanel = styled.div`
  width: 500px;
  ${tw`rounded bg-gray-100 p-4`};
  position: absolute;
  top: 8px;
  left: 8px;
`;

const ButtonLink = styled.a`
  ${tw`whitespace-nowrap inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-red-600 hover:bg-red-700`};
`;
const ToggleLink = styled.a<{ toggleOn: boolean }>`
  ${tw`whitespace-nowrap inline-flex items-center justify-center px-1 py-1 border rounded-md shadow-sm text-xs font-medium text-white `};

  ${(p) => {
    if (p.toggleOn) {
      return tw`border-transparent bg-red-600 hover:bg-red-700`;
    }

    return tw`bg-white text-red-700 border-red-700 hover:bg-red-100`;
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

function createGhostNode(node: Node): Node {
  return {
    ...node,
    parent_id: node.node_id,
    node_id: `${node.node_id}-ghost`,
  };
}

function ghostNodeToCytoscape(node: Node): cytoscape.NodeDefinition {
  return {
    data: {
      ...nodeToCytoscape(node).data,
      group: "ghost",
    },
  };
}

const preprocessNodeForCytoscape =
  (callback: (x: cytoscape.NodeDefinition) => void) =>
  (props: { node: Node; last_activity: LastActivity | undefined }) => {
    const { node, last_activity } = props;

    let processedNode = nodeToCytoscape(node);

    if (node.node_id.endsWith("-ghost")) {
      processedNode = ghostNodeToCytoscape(node);
    }

    if (last_activity) {
      const maybeDate = parseISO(last_activity);
      if (isValid(maybeDate)) {
        const isActive = isWithinInterval(maybeDate, {
          start: subHours(new Date(), 1),
          end: new Date(),
        });
        // console.log("isActive", isActive);
        if (!isActive) {
          processedNode.data["inactive"] = "foo";
        }
      }
    }

    callback(processedNode);
  };

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
  activeNodes: ActiveNodes;
  nodeSources: Set<NodeType>;
  setNodeSources: (nodeTypes: Set<NodeType>) => void;
  toggleNodeSource: (nodeType: NodeType) => void;
  nodeTargets: Set<NodeType>;
  setNodeTargets: (nodeTypes: Set<NodeType>) => void;
  toggleNodeTarget: (nodeType: NodeType) => void;
  edgeStatuses: Set<EdgeStatus>;
  toggleEdgeStatuses: (status: EdgeStatus) => void;
  setEdgeStatuses: (edge_statuses: Set<EdgeStatus>) => void;
  histogramData: HistogramData;
  startDate: Date | undefined;
  endDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  setEndDate: (date: Date | undefined) => void;
  trafficVolumeFilter: number;
  setTrafficVolumeFilter: (volume: number) => void;
};

type GraphReference = {
  nodes: Set<string>;
  edges: Set<string>;
};

type State = {
  nodes: Map<Uuid, Node>;
  node_activities: Map<Uuid, LastActivity>;
  edges: Map<string, CombinedEdge>;

  staging: {
    add: GraphReference;
    remove: GraphReference;
    previousNodes: Map<Uuid, Node>;
    previousEdges: Map<string, CombinedEdge>;
  };
  committed: GraphReference;

  details: DetailsPayload | undefined;

  timeRangeCountKey: number;
};

class ServiceGraphView extends React.Component<Props, State> {
  state: State = {
    nodes: new Map(),
    edges: new Map(),
    node_activities: new Map(),
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
    timeRangeCountKey: 1,
  };

  serviceGraphContainerElement = React.createRef<HTMLDivElement>();
  graph: cytoscape.Core | undefined = undefined;
  layout: cytoscape.Layouts | undefined = undefined;
  minimap: any = undefined;

  static getDerivedStateFromProps(props: Props, prevState: State): State {
    const { data, activeNodes } = props;

    const nodesMap: Map<Uuid, Node> = new Map();
    const edgesMap: Map<string, CombinedEdge> = new Map();
    const node_activities: Map<Uuid, LastActivity> = new Map();

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

    const parents: Set<string> = new Set();
    const serviceNodes: Set<string> = new Set();

    data.nodes.forEach((node) => {
      // update nodes dictionary with latest node information
      nodesMap.set(node.node_id, node);

      if (node.node_type === "service" && !node.parent_id) {
        serviceNodes.add(node.node_id);
      }
      if (node.node_type === "transaction" && node.parent_id) {
        parents.add(node.parent_id);
      }

      // assume node is new; if it is not new, then it'll be removed from staging
      // when prevState.committed.nodes is traversed
      staging.add.nodes.add(node.node_id);
    });

    // Get serviceNodes that are not parents
    const childlessServiceNodes: string[] = Array.from(serviceNodes).filter(
      (id) => !parents.has(id)
    );
    childlessServiceNodes.forEach((nodeId) => {
      const node = nodesMap.get(nodeId);
      if (node) {
        const ghostNode = createGhostNode(node);
        nodesMap.set(ghostNode.node_id, ghostNode);
        staging.add.nodes.add(ghostNode.node_id);
        // console.log("create ghosts");
      }
    });

    // add any active nodes and mark stale active node to be removed from the cytoscape graph
    activeNodes.nodes.forEach((node) => {
      node_activities.set(node.node_id, node.last_activity);

      // if (!nodesMap.has(node.node_id)) {
      //   nodesMap.set(node.node_id, node);
      // }

      // if (node.node_type === "service" && !node.parent_id) {
      //   const ghostNode = createGhostNode(node);
      //   nodesMap.set(ghostNode.node_id, ghostNode);
      //   staging.add.nodes.add(ghostNode.node_id);
      // }

      // assume node is new; if it is not new, then it'll be removed from staging
      // when prevState.committed.nodes is traversed
      // staging.add.nodes.add(node.node_id);
    });
    // console.log("prevState.committed", prevState.committed);

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
        node_activities,
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
          preprocessNodeForCytoscape((node) => {
            nodes.push(node);
          })({ node, last_activity: this.state.node_activities.get(node_id) });
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
              label: "data(name)",
              "text-valign": "bottom",
              "background-opacity": 0.9,
              "text-margin-y": 5,
              "font-family": "Roboto Mono",
              "font-size": "17px",
              "border-width": 2,
            },
          },
          {
            selector: "node[inactive]",
            style: {
              "background-color": colors.INACTIVE_NODE,
              "border-color": colors.INACTIVE_NODE,
              opacity: 0.5,
            },
          },
          {
            selector: "node:childless",
            style: {
              "border-color": colors.TRANSACTION_NODE_BORDER,
              "border-width": 1,
              "border-style": "solid",
              "background-color": colors.TRANSACTION_NODE_BG,
              label: "data(name)",
              "text-valign": "bottom",
              // "background-image": "./cloud.svg",
              // "background-fit": "cover",
              // "background-repeat": "no-repeat",
              // shape: "rectangle",
            },
          },
          {
            selector: 'node[group="ghost"]',
            style: {
              height: 0,
              visibility: "hidden",
            },
          },
          {
            selector: ":parent",
            style: {
              "background-color": colors.SERVICE_NODE_BG,
              "border-color": colors.SERVICE_NODE_BORDER,
              "text-valign": "bottom",
              shape: "rectangle",
            },
          },
          {
            selector: "edge",
            style: {
              "line-color": colors.EDGE_HEALTHY,
              "target-arrow-color": colors.EDGE_HEALTHY,
              "curve-style": "bezier",
              "target-arrow-shape": "triangle",
            },
          },
          {
            selector: 'edge[group="unhealthy"]',
            style: {
              "line-color": colors.EDGE_UNHEALTHY,
              "target-arrow-color": colors.EDGE_UNHEALTHY,
            },
          },
          {
            selector: 'node[group="unhealthy"]',
            style: {
              "background-color": colors.NODE_UNHEALTHY_BG,
              "background-opacity": 0.3,
            },
          },
          {
            selector: 'node[group="unhealthy"]:selected',
            style: {
              "background-opacity": 1,
            },
          },
          {
            selector: 'node[group!="unhealthy"]',
            style: {},
          },
          {
            selector: 'node > node[group!="unhealthy"]:selected',
            style: {
              "background-color": colors.TRANSACTION_NODE_BG_SELECTED,
            },
          },
          {
            selector: 'node[group!="unhealthy"]:compound:selected',
            style: {
              "background-color": colors.SERVICE_NODE_BG_SELECTED,
            },
          },
          {
            selector: 'edge[group="unhealthy"]:selected',
            style: {
              "line-color": colors.EDGE_UNHEALTHY_SELECTED,
              "target-arrow-color": colors.EDGE_UNHEALTHY_SELECTED,
            },
          },
          {
            selector: 'edge[group!="unhealthy"]:selected',
            style: {
              "line-color": colors.EDGE_HEALTHY_SELECTED,
              "target-arrow-color": colors.EDGE_HEALTHY_SELECTED,
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
      this.graph.nodeHtmlLabel([
        {
          query: "node[node_type = 'service'][group != 'ghost']:parent", // cytoscape query selector
          halign: "center", // title vertical position. Can be 'left',''center, 'right'
          valign: "top", // title vertical position. Can be 'top',''center, 'bottom'
          halignBox: "center", // title vertical position. Can be 'left',''center, 'right'
          valignBox: "top", // title relative box vertical position. Can be 'top',''center, 'bottom'
          cssClass: "", // any classes will be as attribute of <div> container for every title
          tpl(data: any) {
            return "<div class='cloud-icon'></div>"; // your html template here
          },
        },
      ]);

      // @ts-expect-error
      this.graph.nodeHtmlLabel([
        {
          query: "node[node_type = 'transaction'][group != 'ghost']:selected", // cytoscape query selector
          halign: "center", // title vertical position. Can be 'left',''center, 'right'
          valign: "bottom", // title vertical position. Can be 'top',''center, 'bottom'
          halignBox: "center", // title vertical position. Can be 'left',''center, 'right'
          valignBox: "top", // title relative box vertical position. Can be 'top',''center, 'bottom'
          cssClass: "", // any classes will be as attribute of <div> container for every title
          tpl(data: any) {
            return "<div class='selected-transaction'></div>"; // your html template here
          },
        },
      ]);

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

      this.styleEdges();

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

      // console.log("this.state.staging", this.state.staging);

      // this.graph
      //   ?.nodes("*")
      //   .toArray()
      //   .forEach((node) => {
      //     const node_id = node.id();
      //     if (!this.state.nodes.has(node_id)) {
      //       this.graph?.remove(`node[id = '${node_id}']`);
      //     }
      //   });

      // this.state.nodes.forEach((node) => {
      //   if (this.graph?.nodes(`[id = '${node.node_id}']`).empty()) {
      //     preprocessNodeForCytoscape((node) => {
      //       this.graph?.add(node);
      //     })({
      //       node,
      //       last_activity: this.state.node_activities.get(node.node_id),
      //     });
      //     console.log("add node");
      //   }
      // });

      // this.state.nodes.forEach((node) => {
      //   if (node.parent_id && this.state.nodes.has(node.parent_id)) {
      //     this.graph
      //       ?.nodes(`[id = '${node.node_id}']`)
      //       .move({ parent: node.parent_id });
      //     console.log("repair parent", {
      //       node_id: node.node_id,
      //       parent_id: node.parent_id,
      //     });
      //   }
      // });

      // this.graph
      //   ?.edges("*")
      //   .toArray()
      //   .forEach((edge) => {
      //     const source_id = edge.source().id();
      //     const destination_id = edge.target().id();
      //     if (
      //       !this.state.edges.has(
      //         getEdgeKeyWithSourceTarget(source_id, destination_id)
      //       )
      //     ) {
      //       const selector = `edge[source = '${source_id}'][target = '${destination_id}']`;
      //       this.graph?.remove(selector);
      //       console.log("remove edge");
      //     }
      //   });

      // this.state.edges.forEach((edge) => {
      //   const selector = `edge[source = '${edge.from_node_id}'][target = '${edge.to_node_id}']`;

      //   if (this.graph?.elements(selector).empty()) {
      //     this.graph?.add(edgeToCytoscape(edge));
      //     console.log("add edge");
      //   }
      // });

      //-----

      this.graph?.remove(`*`);

      // console.log("this.state.nodes", this.state.nodes);

      this.state.nodes.forEach((node) =>
        preprocessNodeForCytoscape((node) => {
          this.graph?.add(node);
        })({
          node,
          last_activity: this.state.node_activities.get(node.node_id),
        })
      );

      this.state.edges.forEach((edge) => {
        this.graph?.add(edgeToCytoscape(edge));
      });

      this.state.nodes.forEach((node) => {
        if (node.parent_id && this.state.nodes.has(node.parent_id)) {
          this.graph
            ?.nodes(`[id = '${node.node_id}']`)
            .move({ parent: node.parent_id });
          // console.log("repair parent", {
          //   node_id: node.node_id,
          //   parent_id: node.parent_id,
          // });
        }
      });

      // ----

      // TODO: simplify?
      const committed = {
        nodes: new Set(this.state.nodes.keys()),
        edges: new Set(
          Array.from(this.state.edges.values()).map((edge) => {
            return getEdgeKey(edge);
          })
        ),
      };

      this.styleEdges();

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
          last_activity: this.state.node_activities.get(node.node_id),
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
          source: {
            node: sourceNode,
            last_activity: this.state.node_activities.get(sourceNode.node_id),
          },
          destination: {
            node: destinationNode,
            last_activity: this.state.node_activities.get(
              destinationNode.node_id
            ),
          },
        };
      }
    }

    return undefined;
  };

  remountTimeRangeComponent = () => {
    this.setState({
      timeRangeCountKey: this.state.timeRangeCountKey + 1,
    });
  };

  styleEdges = () => {
    // set width based on volume

    const volumes: number[] = [];

    this.state.edges.forEach((edge) => {
      volumes.push(
        edge.status_expected_error +
          edge.status_ok +
          edge.status_unexpected_error
      );
    });

    const minVolume = Math.min(...volumes);
    const maxVolume = Math.max(...volumes);

    // console.log("minVolume", minVolume);
    // console.log("maxVolume", maxVolume);

    const percentage = (volume: number) => {
      if (maxVolume - minVolume === 0) {
        return 0;
      }

      return Math.abs(volume - minVolume) / Math.abs(maxVolume - minVolume);
    };

    this.state.edges.forEach((edge) => {
      const volume =
        edge.status_expected_error +
        edge.status_ok +
        edge.status_unexpected_error;

      const cytoscapeEdge = edgeToCytoscape(edge);

      // only apple width for transaction to transaciton
      const sourceNode = this.state.nodes.get(cytoscapeEdge.data.source);
      const targetNode = this.state.nodes.get(cytoscapeEdge.data.target);
      if (
        sourceNode &&
        targetNode &&
        sourceNode.node_type === "transaction" &&
        targetNode.node_type === "transaction"
      ) {
        this.graph
          ?.elements(
            `edge[source = '${cytoscapeEdge.data.source}'][target = '${cytoscapeEdge.data.target}']`
          )
          .style("width", lerp(1, 10, percentage(volume)));
      }
    });
  };

  render() {
    const {
      setNodeSources,
      setNodeTargets,
      // toggleNodeSource,
      nodeSources,
      // toggleNodeTarget,
      nodeTargets,
      edgeStatuses,
      toggleEdgeStatuses,
      setEdgeStatuses,
      // trafficVolumeFilter,
      setTrafficVolumeFilter,
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
            <div>
              <ToggleLink
                href="#"
                toggleOn={
                  (nodeSources.has("transaction") &&
                    nodeSources.has("service") &&
                    nodeTargets.has("transaction") &&
                    nodeTargets.has("service")) ||
                  (nodeSources.size === 0 && nodeTargets.size === 0)
                }
                onClick={(event) => {
                  event.preventDefault();
                  const types = new Set([
                    "transaction",
                    "service",
                  ] as NodeType[]);
                  setNodeSources(types);
                  setNodeTargets(types);
                }}
              >
                All
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={
                  nodeSources.has("transaction") ||
                  nodeTargets.has("transaction") ||
                  (nodeSources.size === 0 && nodeTargets.size === 0)
                }
                onClick={(event) => {
                  event.preventDefault();
                  const types = new Set(["transaction"] as NodeType[]);
                  setNodeSources(types);
                  setNodeTargets(types);
                }}
              >
                Transactions
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={
                  nodeSources.has("service") ||
                  nodeTargets.has("service") ||
                  (nodeSources.size === 0 && nodeTargets.size === 0)
                }
                onClick={(event) => {
                  event.preventDefault();
                  const types = new Set(["service"] as NodeType[]);
                  setNodeSources(types);
                  setNodeTargets(types);
                }}
              >
                Services
              </ToggleLink>
            </div>
          </div>
          <div className="mt-2 grid grid-flow-col auto-cols-min gap-2 grid-rows-2 items-center">
            <div className="row-span-2">
              <strong>Edge</strong>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={
                  (nodeSources.has("service") && nodeTargets.has("service")) ||
                  (nodeSources.size === 0 && nodeTargets.size === 0)
                }
                onClick={(event) => {
                  event.preventDefault();
                  const types = new Set(["service"] as NodeType[]);
                  setNodeSources(types);
                  setNodeTargets(types);
                }}
              >
                Service-Service
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={
                  (nodeSources.has("transaction") &&
                    nodeTargets.has("transaction")) ||
                  (nodeSources.size === 0 && nodeTargets.size === 0)
                }
                onClick={(event) => {
                  event.preventDefault();
                  const types = new Set(["transaction"] as NodeType[]);
                  setNodeSources(types);
                  setNodeTargets(types);
                }}
              >
                Transaction-Transaction
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={
                  (nodeSources.has("service") &&
                    nodeTargets.has("transaction")) ||
                  (nodeSources.size === 0 && nodeTargets.size === 0)
                }
                onClick={(event) => {
                  event.preventDefault();
                  setNodeSources(new Set(["service"] as NodeType[]));
                  setNodeTargets(new Set(["transaction"] as NodeType[]));
                }}
              >
                Service-Transaction
              </ToggleLink>
            </div>
            <div>
              <ToggleLink
                href="#"
                toggleOn={
                  (nodeSources.has("transaction") &&
                    nodeTargets.has("service")) ||
                  (nodeSources.size === 0 && nodeTargets.size === 0)
                }
                onClick={(event) => {
                  event.preventDefault();
                  setNodeSources(new Set(["transaction"] as NodeType[]));
                  setNodeTargets(new Set(["service"] as NodeType[]));
                }}
              >
                Transaction-Service
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
          <div className="mt-2 grid grid-flow-col auto-cols-min gap-2 items-center">
            <div>
              <ToggleLink
                href="#"
                toggleOn={false}
                onClick={(event) => {
                  event.preventDefault();
                  setNodeSources(new Set([] as NodeType[]));
                  setNodeTargets(new Set([] as NodeType[]));
                  setEdgeStatuses(new Set());
                  setTrafficVolumeFilter(0);
                }}
              >
                Reset
              </ToggleLink>
            </div>
            {/* <div style={{ minWidth: "200px" }}>
              <strong>
                <small>Traffic Volume - {trafficVolumeFilter}%</small>
              </strong>
              <input
                type="range"
                id="volume"
                name="volume"
                min="0"
                max="100"
                value={trafficVolumeFilter}
                onChange={(event) =>
                  setTrafficVolumeFilter(Number(event.target.value))
                }
              />
            </div> */}
          </div>
        </Controls>
        <TimerangeContainer>
          <RangeSliderComponent
            key={String(this.state.timeRangeCountKey)}
            data={this.props.histogramData}
            setStartDate={this.props.setStartDate}
            setEndDate={this.props.setEndDate}
            remount={this.remountTimeRangeComponent}
          />
        </TimerangeContainer>
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

const TimerangeContainer = styled.div`
  position: absolute;
  bottom: 8px;
  left: 5px;
  width: 600px;
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

  const timelineHistogramQuery = useQuery<HistogramData, Error>(
    "timelineHistogram",
    fetchTimelineHistogram,
    {
      // Refetch the data every second
      refetchInterval: 5000,
    }
  );

  // console.log("timelineHistogramQuery", timelineHistogramQuery.data);

  const [trafficVolumeFilter, setTrafficVolumeFilter] = useThrottle<number>(0);

  const [startDate, setStartDate] = useThrottle<Date | undefined>(undefined);

  const [endDate, setEndDate] = useThrottle<Date | undefined>(undefined);

  const { isLoading, error, data, refetch } = useQuery<
    ServiceMapPayload,
    Error
  >(
    "serviceMap",
    fetchServiceGraph({
      nodeSources,
      nodeTargets,
      edgeStatuses,
      startDate,
      endDate,
      trafficVolumeFilter,
    }),
    {
      // Refetch the data every second
      refetchInterval: 1000,
    }
  );

  // console.log("data", data);
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
      activeNodes={data.active_nodes}
      nodeSources={nodeSources}
      toggleNodeSource={toggleNodeSource}
      nodeTargets={nodeTargets}
      toggleNodeTarget={toggleNodeTarget}
      setNodeSources={setNodeSources}
      setNodeTargets={setNodeTargets}
      edgeStatuses={edgeStatuses}
      toggleEdgeStatuses={toggleEdgeStatuses}
      setEdgeStatuses={setEdgeStatuses}
      histogramData={
        timelineHistogramQuery.data ?? ({ buckets: [] } as HistogramData)
      }
      setStartDate={setStartDate}
      setEndDate={setEndDate}
      startDate={startDate}
      endDate={endDate}
      trafficVolumeFilter={trafficVolumeFilter}
      setTrafficVolumeFilter={setTrafficVolumeFilter}
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

// simple linear interpolation between start and end such that needle is between [0, 1]
const lerp = (start: number, end: number, needle: number) => {
  return start + needle * (end - start);
};

export default ServiceGraph;
