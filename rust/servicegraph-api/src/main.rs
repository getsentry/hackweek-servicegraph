mod registry;

#[macro_use] extern crate rocket;

use std::borrow::Cow;
use rocket::serde::json::{Json};
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


#[post("/echo_trace", format = "json", data = "<graph_trace>")]
fn echo_trace(graph_trace: Json<GraphTrace>) -> Json<GraphTrace> {
    println!("Received trace with id {} message {}", graph_trace.id, graph_trace.message);
    return graph_trace;
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
    struct HostRegister {
    project_id: u64,
    host_uuid: Option<String>,
    service_name: String
}

#[post("/register_host", format = "json", data = "<host_register>")]
fn register_host(host_register: Json<HostRegister>) -> String{
    let result_uuid = registry::register_host(host_register.project_id, &host_register.host_uuid, &host_register.service_name);
    let mut res = String::new();
    res.push_str(&result_uuid.to_urn().to_string()[9..]);
    return res
}



#[launch]
fn rocket() -> _ {
    rocket::build()
    .mount("/", routes![index])
    .mount("/", routes![echo_trace])
    .mount("/", routes![register_host])
}
