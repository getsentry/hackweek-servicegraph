use rocket::serde::json::Json;
use serde::{Deserialize, Serialize};

use crate::db::get_client;
use crate::db::{register_edges, register_nodes};
use crate::error::ApiError;
use crate::payloads::{Edge, Node};

#[derive(Serialize, Deserialize)]
pub struct SubmitData {
    project_id: u64,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
}

#[post("/submit", format = "json", data = "<data>")]
pub async fn submit(data: Json<SubmitData>) -> Result<String, ApiError> {
    let mut client = get_client().await?;
    if !data.nodes.is_empty() {
        register_nodes(&mut client, &data.nodes).await?;
    }
    if !data.edges.is_empty() {
        register_edges(&mut client, &data.edges).await?;
    }
    Ok("".into())
}
