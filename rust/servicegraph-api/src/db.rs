use std::collections::HashMap;

use chrono::Utc;
use chrono_tz::Tz;
use clickhouse_rs::{Block, ClientHandle, Pool};
use lazy_static::lazy_static;
use uuid::Uuid;

use crate::payloads::{CombinedEdge, Edge, Graph, Node, NodeType};

lazy_static! {
    static ref CLICKHOUSE_POOL: Pool =
        Pool::new("tcp://localhost:9000/servicegraph?compression=lz4");
}

pub async fn get_client() -> Result<ClientHandle, anyhow::Error> {
    Ok(CLICKHOUSE_POOL.get_handle().await?)
}

pub async fn register_nodes(
    client: &mut ClientHandle,
    project_id: u64,
    nodes: &[Node],
) -> anyhow::Result<()> {
    let now = Utc::now().with_timezone(&Tz::UTC);
    let block = Block::new()
        .column("project_id", vec![project_id; nodes.len()])
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

pub async fn register_edges(
    client: &mut ClientHandle,
    project_id: u64,
    edges: &[Edge],
) -> anyhow::Result<()> {
    let block = Block::new()
        .column("project_id", vec![project_id; edges.len()])
        .column(
            "ts",
            edges
                .iter()
                .map(|x| x.ts.with_timezone(&Tz::UTC))
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

pub async fn query_graph(
    client: &mut ClientHandle,
    project_id: u64,
) -> Result<Graph, anyhow::Error> {
    let block = client
        .query(&format!(
            "
        SELECT
            edges.from_node_id from_node_id,
            from_node.name as from_node_name,
            from_node.node_type as from_node_type,
            from_node.parent_id as from_node_parent_id,
            edges.to_node_id to_node_id,
            to_node.name as to_node_name,
            to_node.node_type as to_node_type,
            to_node.parent_id as to_node_parent_id,
            edges.status_ok status_ok,
            edges.status_expected_error status_expected_error,
            edges.status_unexpected_error status_unexpected_error
        FROM edges_by_minute_mv edges
        JOIN nodes from_node
          ON from_node.node_id = edges.from_node_id
         AND from_node.project_id = edges.project_id
        JOIN nodes to_node
          ON to_node.node_id = edges.to_node_id
         AND to_node.project_id = edges.project_id
        WHERE edges.project_id = {}",
            project_id
        ))
        .fetch_all()
        .await?;

    let mut edges = Vec::new();
    let mut nodes: HashMap<Uuid, Node> = HashMap::new();

    for row in block.rows() {
        edges.push(CombinedEdge {
            from_node_id: row.get("from_node_id")?,
            to_node_id: row.get("to_node_id")?,
            status_ok: row.get("status_ok")?,
            status_expected_error: row.get("status_expected_error")?,
            status_unexpected_error: row.get("status_unexpected_error")?,
        });
        nodes.insert(
            row.get("from_node_id")?,
            Node {
                node_id: row.get("from_node_id")?,
                node_type: NodeType::from_u8(row.get("from_node_type")?),
                name: row.get("from_node_name")?,
                parent_id: row.get("from_node_parent_id")?,
            },
        );
        nodes.insert(
            row.get("to_node_id")?,
            Node {
                node_id: row.get("to_node_id")?,
                node_type: NodeType::from_u8(row.get("to_node_type")?),
                name: row.get("to_node_name")?,
                parent_id: row.get("to_node_parent_id")?,
            },
        );
    }

    Ok(Graph {
        edges,
        nodes: nodes.into_values().collect(),
    })
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
            parent_id: None,
        };

        let node_two = Node {
            node_id: Uuid::new_v4(),
            node_type: NodeType::Service,
            name: String::from("service_b"),
            parent_id: None,
        };

        let mut client = get_client().await.unwrap();
        register_nodes(&mut client, 1, &vec![node_one, node_two])
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_insert_connections() {
        let node_one = Node {
            node_id: Uuid::new_v4(),
            node_type: NodeType::Service,
            name: String::from("service_a"),
            parent_id: None,
        };

        let node_two = Node {
            node_id: Uuid::new_v4(),
            node_type: NodeType::Service,
            name: String::from("service_b"),
            parent_id: None,
        };

        let edge = Edge {
            ts: Utc::now(),
            from_node_id: node_one.node_id,
            to_node_id: node_two.node_id,
            status: EdgeStatus::Ok,
            n: 1,
        };

        let mut client = get_client().await.unwrap();
        register_nodes(&mut client, 1, &vec![node_one, node_two])
            .await
            .unwrap();

        let mut client = get_client().await.unwrap();
        register_edges(&mut client, 1, &vec![edge]).await.unwrap();
    }
}
