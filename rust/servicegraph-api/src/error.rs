use std::io::Cursor;

pub use anyhow::Error;

use rocket::{
    http::ContentType,
    response::{self, Responder},
    Request, Response,
};

pub struct ApiError {
    error: Error,
}

impl From<Error> for ApiError {
    fn from(error: Error) -> ApiError {
        dbg!(&error);
        ApiError { error }
    }
}

impl<'r> Responder<'r, 'static> for ApiError {
    fn respond_to(self, _request: &'r Request<'_>) -> response::Result<'static> {
        let error = format!("error: {}", self.error);
        Response::build()
            .sized_body(error.len(), Cursor::new(error))
            .header(ContentType::new("text", "plain"))
            .ok()
    }
}
