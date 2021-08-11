mod payloads;

#[macro_use]
extern crate rocket;
mod db;
mod endpoints;
mod error;

use rocket::http::Method;
use rocket_cors::{AllowedHeaders, AllowedOrigins, CorsOptions};

#[launch]
fn rocket() -> _ {
    let cors = CorsOptions {
        allowed_origins: AllowedOrigins::all(),
        allowed_methods: vec![Method::Get, Method::Post, Method::Options]
            .into_iter()
            .map(From::from)
            .collect(),
        allowed_headers: AllowedHeaders::some(&["Authorization", "Accept", "Content-Type"]),
        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()
    .unwrap();

    rocket::build()
        .mount(
            "/",
            routes![
                endpoints::submit,
                endpoints::query_graph,
                endpoints::query_active_nodes,
                endpoints::query_service_map,
                endpoints::health
            ],
        )
        .mount("/", rocket_cors::catch_all_options_routes())
        .attach(cors.clone())
        .manage(cors)
}
