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
    from_node_id: [u8; 16],
    to_node_id: [u8; 16],
    n: u32,
}

async fn register_node(client: &Client, node: payloads::NodeInfo) -> Result<()> {
    let row = Node {
        id: *node.uuid.as_bytes(),
        service_name: node.name,
        transaction_name: node.transaction,
        description: node.description,
    };
    let mut insert = client.insert("nodes")?;
    insert.write(&row).await?;
    insert.end().await
}

async fn insert_connections(
    client: &Client,
    from_node_id: Uuid,
    to_node_id: Uuid,
    n: u32,
) -> Result<()> {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let row = Connections {
        checkin_time: now as u32,
        from_node_id: *from_node_id.as_bytes(),
        to_node_id: *to_node_id.as_bytes(),
        n,
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

#[tokio::test]
async fn test_register_node() {
    let node_one = payloads::NodeInfo {
        name: String::from("ServiceA"),
        transaction: String::from(""),
        description: String::from("a service"),
        uuid: "418f3d00-ba14-42eb-98b8-5f3fb1b975c8".parse().unwrap(),
    };

    let node_two = payloads::NodeInfo {
        name: String::from("ServiceB"),
        transaction: String::from(""),
        description: String::from("another service"),
        uuid: "5042546b-07a0-41d4-a73c-9138722eebb4".parse().unwrap(),
    };

    let client = get_client();
    register_node(&client, node_one).await.unwrap();
    register_node(&client, node_two).await.unwrap();
}

#[tokio::test]
async fn test_insert_connections() {
    let client = get_client();
    let src = "418f3d00-ba14-42eb-98b8-5f3fb1b975c8".parse().unwrap();
    let dst = "5042546b-07a0-41d4-a73c-9138722eebb4".parse().unwrap();
    insert_connections(&client, src, dst, 20).await.unwrap();
}
