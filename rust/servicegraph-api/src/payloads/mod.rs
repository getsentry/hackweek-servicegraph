use rocket::serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct HostIdentity {
    pub hostname: String,
    pub project_id: u64,
    pub host_node_uuid: Option<String>,
    pub host_type: String,
    pub description: String,
    pub ip: String, // TODO: Make this a proper IP type, for now trust it's a real IP,
    pub port: u64,
}

type NodeUuid = String;

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct ConnectionInfo {
    pub to_node: NodeUuid,
    pub hitcount: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct NodeInfo {
    pub name: String,
    pub description: String,
    pub transaction: String,
    pub uuid: NodeUuid,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct GraphPayload {
    pub adjacency_map: HashMap<NodeUuid, Vec<ConnectionInfo>>,
    pub metadata: HashMap<NodeUuid, NodeInfo>,
}
