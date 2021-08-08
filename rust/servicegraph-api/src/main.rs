#[macro_use] extern crate rocket;

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



#[launch]
fn rocket() -> _ {
    rocket::build()
    .mount("/", routes![index])
    .mount("/", routes![log_trace])
}
