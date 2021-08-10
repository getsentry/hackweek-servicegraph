mod payloads;

#[macro_use]
extern crate rocket;
mod db;
mod error;

use db::get_client;
use error::ApiError;
use payloads::{Edge, Node};
use rocket::serde::json::Json;
use serde::{Deserialize, Serialize};

use crate::db::{register_edges, register_nodes};

#[derive(Serialize, Deserialize)]
struct SubmitData {
    project_id: u64,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
}

#[post("/submit", format = "json", data = "<data>")]
async fn submit(data: Json<SubmitData>) -> Result<String, ApiError> {
    let mut client = get_client().await?;
    if !data.nodes.is_empty() {
        register_nodes(&mut client, &data.nodes).await?;
    }
    if !data.edges.is_empty() {
        register_edges(&mut client, &data.edges).await?;
    }
    Ok("".into())
}

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/submit", routes![submit])
}
