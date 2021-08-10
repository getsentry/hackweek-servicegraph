use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
#[serde(rename_all = "snake_case")]
pub enum EdgeStatus {
    Ok,
    ExpectedError,
    UnexpectedError,
}

impl EdgeStatus {
    pub fn as_u8(self) -> u8 {
        match self {
            EdgeStatus::Ok => 1,
            EdgeStatus::ExpectedError => 2,
            EdgeStatus::UnexpectedError => 3,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Edge {
    pub checkin_time: DateTime<Utc>,
    pub from_node_id: Uuid,
    pub to_node_id: Uuid,
    pub status: EdgeStatus,
    pub n: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CombinedEdge {
    pub from_node_id: Uuid,
    pub to_node_id: Uuid,
    pub status_ok: u32,
    pub status_expected_error: u32,
    pub status_unexpected_error: u32,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    Service,
    Transaction,
}

impl NodeType {
    pub fn as_u8(self) -> u8 {
        match self {
            NodeType::Service => 1,
            NodeType::Transaction => 2,
        }
    }

    pub fn from_u8(value: u8) -> NodeType {
        match value {
            2 => NodeType::Transaction,
            _ => NodeType::Service,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Node {
    pub node_id: Uuid,
    pub node_type: NodeType,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Graph {
    pub edges: Vec<CombinedEdge>,
    pub nodes: Vec<Node>,
}