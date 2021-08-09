use clickhouse::{error::Result, Client, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Row)]
struct Node {
    id: [u8; 16],
    service_name: String,
}

fn get_connection() -> Client {
    Client::default()
        .with_url("http://localhost:8123")
        .with_database("servicegraph")
}

async fn register_node(connection: Client, node: Node) -> Result<()> {
    let mut insert = connection.insert("nodes")?;
    insert.write(&node).await?;
    insert.end().await
}

#[tokio::test]
async fn test_register_node() {
    let client = get_connection();
    let uuid = *Uuid::parse_str(&"a".repeat(32)).unwrap().as_bytes();
    let node = Node {
        id: uuid,
        service_name: "test-service".to_string(),
    };
    register_node(client, node).await.unwrap();
}
