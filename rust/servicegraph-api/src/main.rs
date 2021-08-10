mod payloads;

#[macro_use]
extern crate rocket;
mod db;
mod endpoints;
mod error;

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/", routes![endpoints::submit])
}
