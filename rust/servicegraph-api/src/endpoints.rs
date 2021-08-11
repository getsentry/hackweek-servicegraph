use rocket::serde::json::Json;
use serde::{Deserialize, Serialize};

use crate::db::{self, get_client};
use crate::db::{register_edges, register_nodes};
use crate::error::ApiError;
use crate::payloads::{ActiveNodes, Edge, Graph, GraphQueryParams, Node, NodeQueryParams};

#[derive(Serialize, Deserialize)]
pub struct SubmitData {
    project_id: u64,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
}

#[get("/health")]
pub fn health() -> String {
    return String::from("OK");
}

#[post("/submit", format = "json", data = "<data>")]
pub async fn submit(data: Json<SubmitData>) -> Result<String, ApiError> {
    let mut client = get_client().await?;
    if !data.nodes.is_empty() {
        register_nodes(&mut client, data.project_id, &data.nodes).await?;
    }
    if !data.edges.is_empty() {
        register_edges(&mut client, data.project_id, &data.edges).await?;
    }
    Ok("".into())
}

#[post("/graph", format = "json", data = "<params>")]
pub async fn query_graph(params: Json<GraphQueryParams>) -> Result<Json<Graph>, ApiError> {
    let mut client = get_client().await?;
    Ok(Json(db::query_graph(&mut client, &params).await?))
}

#[post("/active-nodes", format = "json", data = "<params>")]
pub async fn query_active_nodes(
    params: Json<NodeQueryParams>,
) -> Result<Json<ActiveNodes>, ApiError> {
    let mut client = get_client().await?;
    Ok(Json(db::query_active_nodes(&mut client, &params).await?))
}
