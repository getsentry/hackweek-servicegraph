mod payloads;

#[macro_use] extern crate rocket;
mod db;

use std::collections::HashMap;
use std::borrow::Cow;
use rocket::serde::json::{Json, Value, json};
use rocket::serde::{Serialize, Deserialize, };

type Id = usize;


#[get("/")]
fn index() -> &'static str {
    "Hello, world!"
}


#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
struct GraphTrace<'r> {
    id: Id,
    message: Cow<'r, str>
}


#[post("/log_trace", format = "json", data = "<graph_trace>")]
fn log_trace(graph_trace: Json<GraphTrace>) -> Json<GraphTrace> {
    println!("Received trace with id {} message {}", graph_trace.id, graph_trace.message);
    return graph_trace;
}
static nodes: [&str; 4] = [
    "418f3d00-ba14-42eb-98b8-5f3fb1b975c8", 
    "5042546b-07a0-41d4-a73c-9138722eebb4", 
    "9ac770a6-0a2b-4805-b506-d87ba2510102", 
    "7ce12aae-0acd-4e9b-a145-7848fddb1bfe"
];

#[get("/graph/<project_id>")]
fn get_graph(project_id: u64) -> Json<payloads::GraphPayload> {
    let mut adjacency_map = HashMap::new();
    adjacency_map.insert(
        String::from(nodes[0]), vec![
            payloads::ConnectionInfo{
                to_node: String::from(nodes[1]), 
                hitcount: 12 
            }, 
            payloads::ConnectionInfo{
                to_node: String::from(nodes[2]), 
                hitcount: 420
            }
        ]
    );
    let mut metadata = HashMap::new();
    metadata.insert(
        String::from(nodes[0]), 
        payloads::NodeInfo{
            name: String::from("ServiceA"), 
            description: String::from("root service"), 
            uuid: String::from(nodes[0])}
    );
    metadata.insert(
        String::from(nodes[1]), 
        payloads::NodeInfo{
            name: String::from("ServiceB"), 
            description: String::from("dependent service"), 
            uuid: String::from(nodes[1])}
    );
    metadata.insert(
        String::from(nodes[2]), 
        payloads::NodeInfo{
            name: String::from("ServiceC"), 
            description: String::from("other service"), 
            uuid: String::from(nodes[2])}
    );
    return Json(payloads::GraphPayload {
        adjacency_map,
        metadata

    });
}



#[launch]
fn rocket() -> _ {
    rocket::build()
    .mount("/", routes![index])
    .mount("/", routes![log_trace])
    .mount("/", routes![get_graph])
}
