use rocket::serde::json::Json;
use serde::{Deserialize, Serialize};

use crate::db::{get_client, query_graph};
use crate::db::{register_edges, register_nodes};
use crate::error::ApiError;
use crate::payloads::{Edge, Graph, Node};
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize)]
pub struct SubmitData {
    project_id: u64,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
}

#[derive(Serialize, Deserialize)]
pub struct QueryParams {
    project_id: u64,
    start_date: Option<DateTime<Utc>>,
    end_date: Option<DateTime<Utc>>,
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

#[post("/query", format = "json", data = "<params>")]
pub async fn query(params: Json<QueryParams>) -> Result<Json<Graph>, ApiError> {
    let mut client = get_client().await?;
    Ok(Json(
        query_graph(
            &mut client,
            params.project_id,
            params.start_date,
            params.end_date,
        )
        .await?,
    ))
}
