use rocket::serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub to_node: Uuid,
    pub hitcount: u64,
}

#[derive(Serialize, Deserialize)]
pub struct NodeInfo {
    pub uuid: Uuid,
    pub name: String,
    pub description: String,
    pub transaction: String,
}

#[derive(Serialize, Deserialize)]
pub struct GraphPayload {
    pub adjacency_map: HashMap<Uuid, Vec<ConnectionInfo>>,
    pub metadata: HashMap<Uuid, NodeInfo>,
}
