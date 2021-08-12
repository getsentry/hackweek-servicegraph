export type Uuid = string;

export type CombinedEdge = {
  from_node_id: Uuid;
  to_node_id: Uuid;
  description: string | null;
  class: string | null;
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
  class: string | null;
  parent_id?: Uuid;
  status_ok: number;
  status_expected_error: number;
  status_unexpected_error: number;
};

export type Graph = {
  edges: Array<CombinedEdge>;
  nodes: Array<Node>;
};

// date time string
export type LastActivity = string;

export type NodeWithLastActivity = Node & {
  last_activity: LastActivity;
};

export type ActiveNodes = {
  nodes: Array<NodeWithLastActivity>;
};

export type ServiceMapPayload = {
  graph: Graph;
  active_nodes: ActiveNodes;
};

export type EdgeStatus = "ok" | "unexpected_error" | "expected_error";

export type Bucket = {
  ts: string;
  n: number;
};

export type HistogramData = {
  buckets: Array<Bucket>;
};
