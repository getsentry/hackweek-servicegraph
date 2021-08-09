use clickhouse::{error::Result, Client, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::payloads;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Row)]
struct Node {
    id: [u8; 16],
    service_name: String,
    transaction: String,
    description: String
}

fn get_connection() -> Client {
    Client::default()
        .with_url("http://localhost:8123")
        .with_database("servicegraph")
}

async fn register_node(connection: Client, node: payloads::NodeInfo) -> Result<()> {
    let row = Node{
        id: *Uuid::parse_str(&node.uuid).unwrap().as_bytes(),
        service_name: node.name,
        transaction: node.transaction,
        description: node.description,
    };
    let mut insert = connection.insert("nodes")?;
    insert.write(&row).await?;
    insert.end().await
}

#[tokio::test]
async fn test_register_node() {
    let node = payloads::NodeInfo{
        name: String::from("ServiceA"),
        transaction: String::from(""),
        description: String::from("a service"),
        uuid: String::from("418f3d00-ba14-42eb-98b8-5f3fb1b975c8")
    };

    let client = get_connection();
    register_node(client, node).await.unwrap();
}
