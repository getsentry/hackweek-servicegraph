export type Uuid = string;

export type CombinedEdge = {
  from_node_id: Uuid;
  to_node_id: Uuid;
  status_ok: number;
  status_expected_error: number;
  status_unexpected_error: number;
};

export type NodeType = "service" | "transaction";

export type Node = {
  node_id: Uuid;
  node_type: NodeType;
  name: String;
  parent_id?: Uuid;
};

export type Graph = {
  edges: Array<CombinedEdge>;
  nodes: Array<Node>;
};
