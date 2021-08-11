export type Uuid = string;

export type CombinedEdge = {
  from_node_id: Uuid;
  to_node_id: Uuid;
  description: string | null;
  status_ok: number;
  status_expected_error: number;
  status_unexpected_error: number;
};

export type NodeType = "service" | "transaction";

export type Node = {
  node_id: Uuid;
  node_type: NodeType;
  name: String;
  description: string | null;
  parent_id?: Uuid;
  status_ok: number;
  status_expected_error: number;
  status_unexpected_error: number;
};

export type Graph = {
  edges: Array<CombinedEdge>;
  nodes: Array<Node>;
};

export type NodeActivity = {
  node: Node;
  last_activity: string;
};

export type ActiveNodes = {
  nodes: Array<NodeActivity>;
};

export type ServiceMapPayload = {
  graph: Graph;
  active_nodes: ActiveNodes;
};

export type EdgeStatus = "ok" | "unexpected_error" | "expected_error";
