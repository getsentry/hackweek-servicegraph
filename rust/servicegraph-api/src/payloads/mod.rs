use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Node {
    pub node_id: Uuid,
    pub node_type: NodeType,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct GraphPayload {
    pub adjacency_map: HashMap<Uuid, Vec<Edge>>,
    pub metadata: HashMap<Uuid, Node>,
}
