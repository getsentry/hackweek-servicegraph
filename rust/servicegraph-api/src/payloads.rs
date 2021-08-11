use std::collections::BTreeSet;
use std::ops::Deref;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Default)]
pub struct CommonQueryParams {
    pub project_id: u64,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct GraphQueryParams {
    #[serde(flatten)]
    pub common: CommonQueryParams,
    #[serde(default)]
    pub from_types: BTreeSet<NodeType>,
    #[serde(default)]
    pub to_types: BTreeSet<NodeType>,
}

impl Deref for GraphQueryParams {
    type Target = CommonQueryParams;

    fn deref(&self) -> &Self::Target {
        &self.common
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct NodeQueryParams {
    #[serde(flatten)]
    pub common: CommonQueryParams,
    #[serde(default)]
    pub types: BTreeSet<NodeType>,
}

impl Deref for NodeQueryParams {
    type Target = CommonQueryParams;

    fn deref(&self) -> &Self::Target {
        &self.common
    }
}

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

    #[allow(unused)]
    pub fn from_u8(value: u8) -> Self {
        match value {
            1 => EdgeStatus::Ok,
            2 => EdgeStatus::ExpectedError,
            _ => EdgeStatus::UnexpectedError,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Edge {
    pub ts: DateTime<Utc>,
    pub from_node_id: Uuid,
    pub to_node_id: Uuid,
    pub status: EdgeStatus,
    pub n: u32,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CombinedEdge {
    pub from_node_id: Uuid,
    pub to_node_id: Uuid,
    pub description: Option<String>,
    pub status_ok: u32,
    pub status_expected_error: u32,
    pub status_unexpected_error: u32,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, Hash, Eq, PartialEq, Ord, PartialOrd)]
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
    pub description: Option<String>,
    pub parent_id: Option<Uuid>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NodeActivity {
    #[serde(flatten)]
    pub node: Node,
    pub last_activity: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NodeWithStatus {
    #[serde(flatten)]
    pub node: Node,
    pub status_ok: u32,
    pub status_expected_error: u32,
    pub status_unexpected_error: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Graph {
    pub edges: Vec<CombinedEdge>,
    pub nodes: Vec<NodeWithStatus>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ActiveNodes {
    pub nodes: Vec<NodeActivity>,
}
