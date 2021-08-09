use crate::payloads;
use clickhouse::{error::Result, Client, Row};
use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Row)]
struct Node {
    id: [u8; 16],
    service_name: String,
    transaction_name: String,
    description: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Row)]
struct Connections {
    checkin_time: u32,
    src_scope: [u8; 16],
    dst_scope: [u8; 16],
}

async fn register_node(client: &Client, node: payloads::NodeInfo) -> Result<()> {
    let row = Node {
        id: uuid_to_bytes(&node.uuid),
        service_name: node.name,
        transaction_name: node.transaction,
        description: node.description,
    };
    let mut insert = client.insert("nodes")?;
    insert.write(&row).await?;
    insert.end().await
}

async fn insert_connections(client: &Client, src: &str, dst: &str) -> Result<()> {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs() as u32; // TODO: Hardcoded for now
    let row = Connections {
        checkin_time: now,
        src_scope: uuid_to_bytes(src),
        dst_scope: uuid_to_bytes(dst),
    };
    let mut insert = client.insert("connections")?;
    insert.write(&row).await?;
    insert.end().await
}

fn get_client() -> Client {
    Client::default()
        .with_url("http://localhost:8123")
        .with_database("servicegraph")
}

fn uuid_to_bytes(uuid_str: &str) -> [u8; 16] {
    *Uuid::parse_str(uuid_str).unwrap().as_bytes()
}

#[tokio::test]
async fn test_register_node() {
    let node_one = payloads::NodeInfo {
        name: String::from("ServiceA"),
        transaction: String::from(""),
        description: String::from("a service"),
        uuid: String::from("418f3d00-ba14-42eb-98b8-5f3fb1b975c8"),
    };

    let node_two = payloads::NodeInfo {
        name: String::from("ServiceB"),
        transaction: String::from(""),
        description: String::from("another service"),
        uuid: String::from("5042546b-07a0-41d4-a73c-9138722eebb4"),
    };

    let client = get_client();
    register_node(&client, node_one).await.unwrap();
    register_node(&client, node_two).await.unwrap();
}

#[tokio::test]
async fn test_insert_connections() {
    let client = get_client();
    let src = "418f3d00-ba14-42eb-98b8-5f3fb1b975c8";
    let dst = "5042546b-07a0-41d4-a73c-9138722eebb4";
    insert_connections(&client, src, dst).await.unwrap();
}
