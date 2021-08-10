use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use clickhouse_rs::{Block, ClientHandle, Pool};
use lazy_static::lazy_static;

use crate::payloads::{Edge, Node};

lazy_static! {
    static ref CLICKHOUSE_POOL: Pool =
        Pool::new("tcp://localhost:9000/servicegraph?compression=lz4");
}

async fn register_nodes(mut client: ClientHandle, nodes: &[Node]) -> anyhow::Result<()> {
    let now = Utc::now().with_timezone(&Tz::UTC);
    let block = Block::new()
        .column(
            "node_id",
            nodes.iter().map(|x| x.node_id).collect::<Vec<_>>(),
        )
        .column(
            "node_type",
            nodes
                .iter()
                .map(|x| x.node_type.as_u8())
                .collect::<Vec<_>>(),
        )
        .column(
            "name",
            nodes.iter().map(|x| x.name.clone()).collect::<Vec<_>>(),
        )
        .column("timestamp", vec![now; nodes.len()]);
    client.insert("nodes", block).await?;
    Ok(())
}

async fn register_edges(mut client: ClientHandle, edges: &[Edge]) -> anyhow::Result<()> {
    let block = Block::new()
        .column(
            "checkin_time",
            edges
                .iter()
                .map(|x| x.checkin_time.with_timezone(&Tz::UTC))
                .collect::<Vec<_>>(),
        )
        .column(
            "from_node_id",
            edges.iter().map(|x| x.from_node_id).collect::<Vec<_>>(),
        )
        .column(
            "to_node_id",
            edges.iter().map(|x| x.to_node_id).collect::<Vec<_>>(),
        )
        .column(
            "status",
            edges.iter().map(|x| x.status.as_u8()).collect::<Vec<_>>(),
        )
        .column("n", edges.iter().map(|x| x.n).collect::<Vec<_>>());
    client.insert("edges", block).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::payloads::{EdgeStatus, NodeType};
    use uuid::Uuid;

    #[tokio::test]
    async fn test_register_node() {
        let node_one = Node {
            node_id: Uuid::new_v4(),
            node_type: NodeType::Service,
            name: String::from("service_a"),
        };

        let node_two = Node {
            node_id: Uuid::new_v4(),
            node_type: NodeType::Service,
            name: String::from("service_b"),
        };

        let client = CLICKHOUSE_POOL.get_handle().await.unwrap();
        register_nodes(client, &vec![node_one, node_two])
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_insert_connections() {
        let node_one = Node {
            node_id: Uuid::new_v4(),
            node_type: NodeType::Service,
            name: String::from("service_a"),
        };

        let node_two = Node {
            node_id: Uuid::new_v4(),
            node_type: NodeType::Service,
            name: String::from("service_b"),
        };

        let edge = Edge {
            checkin_time: Utc::now(),
            from_node_id: node_one.node_id,
            to_node_id: node_two.node_id,
            status: EdgeStatus::Ok,
            n: 1,
        };

        let client = CLICKHOUSE_POOL.get_handle().await.unwrap();
        register_nodes(client, &vec![node_one, node_two])
            .await
            .unwrap();

        let client = CLICKHOUSE_POOL.get_handle().await.unwrap();
        register_edges(client, &vec![edge]).await.unwrap();
    }
}
