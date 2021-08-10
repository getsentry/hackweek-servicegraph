use rocket::serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct ConnectionInfo {
    pub to_node: Uuid,
    pub hitcount: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct NodeInfo {
    pub name: String,
    pub description: String,
    pub transaction: String,
    pub uuid: Uuid,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct GraphPayload {
    pub adjacency_map: HashMap<Uuid, Vec<ConnectionInfo>>,
    pub metadata: HashMap<Uuid, NodeInfo>,
}
