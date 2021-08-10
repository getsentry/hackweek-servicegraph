mod payloads;

#[macro_use]
extern crate rocket;
mod db;

use rocket::serde::json::{json, Json, Value};
use rocket::serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::collections::HashMap;

type Id = usize;

#[get("/")]
fn index() -> &'static str {
    "Hello, world!"
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
struct GraphTrace<'r> {
    id: Id,
    message: Cow<'r, str>,
}

#[post("/log_trace", format = "json", data = "<graph_trace>")]
fn log_trace(graph_trace: Json<GraphTrace>) -> Json<GraphTrace> {
    println!(
        "Received trace with id {} message {}",
        graph_trace.id, graph_trace.message
    );
    return graph_trace;
}
static nodes: [&str; 4] = [
    "418f3d00-ba14-42eb-98b8-5f3fb1b975c8",
    "5042546b-07a0-41d4-a73c-9138722eebb4",
    "9ac770a6-0a2b-4805-b506-d87ba2510102",
    "7ce12aae-0acd-4e9b-a145-7848fddb1bfe",
];

#[get("/graph/<project_id>")]
fn get_graph(project_id: u64) -> Json<payloads::GraphPayload> {
    let mut adjacency_map = HashMap::new();
    adjacency_map.insert(
        nodes[0].parse().unwrap(),
        vec![
            payloads::ConnectionInfo {
                to_node: nodes[1].parse().unwrap(),
                hitcount: 12,
            },
            payloads::ConnectionInfo {
                to_node: nodes[2].parse().unwrap(),
                hitcount: 420,
            },
        ],
    );
    let mut metadata = HashMap::new();
    metadata.insert(
        nodes[0].parse().unwrap(),
        payloads::NodeInfo {
            name: String::from("ServiceA"),
            transaction: String::from(""),
            description: String::from("root service"),
            uuid: nodes[0].parse().unwrap(),
        },
    );
    metadata.insert(
        nodes[1].parse().unwrap(),
        payloads::NodeInfo {
            name: String::from("ServiceB"),
            transaction: String::from(""),
            description: String::from("dependent service"),
            uuid: nodes[1].parse().unwrap(),
        },
    );
    metadata.insert(
        nodes[2].parse().unwrap(),
        payloads::NodeInfo {
            name: String::from("ServiceC"),
            transaction: String::from(""),
            description: String::from("other service"),
            uuid: nodes[2].parse().unwrap(),
        },
    );

    Json(payloads::GraphPayload {
        adjacency_map,
        metadata,
    })
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", routes![index])
        .mount("/", routes![log_trace])
        .mount("/", routes![get_graph])
}
