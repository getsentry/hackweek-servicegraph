use std::collections::HashMap;

use chrono::Utc;
use chrono::{DateTime, Duration};
use chrono_tz::Tz;
use clickhouse_rs::{Block, ClientHandle, Pool};
use lazy_static::lazy_static;
use uuid::Uuid;

use crate::error::Error;
use crate::payloads::{ActiveNodes, CombinedEdge, Edge, Graph, Node, NodeActivity, NodeType};

lazy_static! {
    static ref CLICKHOUSE_POOL: Pool =
        Pool::new("tcp://localhost:9000/servicegraph?compression=lz4");
}

pub async fn get_client() -> Result<ClientHandle, Error> {
    Ok(CLICKHOUSE_POOL.get_handle().await?)
}

pub async fn register_nodes(
    client: &mut ClientHandle,
    project_id: u64,
    nodes: &[Node],
) -> Result<(), Error> {
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
        .column(
            "parent_id",
            nodes.iter().map(|x| x.parent_id).collect::<Vec<_>>(),
        )
        .column("timestamp", vec![now; nodes.len()]);
    client.insert("nodes", block).await?;
    Ok(())
}

pub async fn register_edges(
    client: &mut ClientHandle,
    project_id: u64,
    edges: &[Edge],
) -> Result<(), Error> {
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

fn default_date_range(
    start_date: Option<DateTime<Utc>>,
    end_date: Option<DateTime<Utc>>,
) -> (DateTime<Utc>, DateTime<Utc>) {
    (
        match start_date {
            Some(s) => s,
            None => Utc::now() - Duration::hours(1),
        },
        match end_date {
            Some(s) => s,
            None => Utc::now(),
        },
    )
}

pub async fn query_graph(
    client: &mut ClientHandle,
    project_id: u64,
    start_date: Option<DateTime<Utc>>,
    end_date: Option<DateTime<Utc>>,
) -> Result<Graph, Error> {
    let (start_date_bound, end_date_bound) = default_date_range(start_date, end_date);
    let block = client
        .query(&format!(
            "
        SELECT
            edges.from_node_id as from_node_id,
            from_node.name as from_node_name,
            from_node.node_type as from_node_type,
            from_node.parent_id as from_node_parent_id,
            edges.to_node_id as to_node_id,
            to_node.name as to_node_name,
            to_node.node_type as to_node_type,
            from_node.parent_id as to_node_parent_id,
            toUInt32(sumIfMerge(edges.status_ok)) as status_ok,
            toUInt32(sumIfMerge(edges.status_expected_error)) as status_expected_error,
            toUInt32(sumIfMerge(edges.status_unexpected_error)) as status_unexpected_error
        FROM edges_by_minute_mv edges
        JOIN nodes from_node
          ON from_node.node_id = edges.from_node_id
         AND from_node.project_id = edges.project_id
        JOIN nodes to_node
          ON to_node.node_id = edges.to_node_id
         AND to_node.project_id = edges.project_id
        WHERE edges.project_id = {} AND edges.ts >= toDateTime('{}') AND edges.ts <= toDateTime('{}')
        GROUP BY from_node_id, from_node_name, from_node_type, from_node_parent_id, to_node_id, to_node_name, to_node_type, to_node_parent_id",
            project_id,
            start_date_bound.format("%Y-%m-%d %H:%M:%S"),
            end_date_bound.format("%Y-%m-%d %H:%M:%S"),
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

pub async fn query_active_nodes(
    client: &mut ClientHandle,
    project_id: u64,
    start_date: Option<DateTime<Utc>>,
    end_date: Option<DateTime<Utc>>,
) -> Result<ActiveNodes, Error> {
    let (start_date_bound, end_date_bound) = default_date_range(start_date, end_date);
    let block = client
        .query(&format!(
            "
            SELECT
                s.node_id as node_id,
                s.last_activity as last_activity,
                nodes.name as node_name,
                nodes.node_type as node_type,
                nodes.parent_id as node_parent_id
            FROM (
                SELECT
                    s.node_id node_id,
                    max(s.last_activity) last_activity
                FROM
                (
                    SELECT
                        from_node_id AS node_id,
                        max(ts) AS last_activity
                    FROM edges_by_minute_mv
                    WHERE project_id = {} AND ts >= toDateTime('{}') AND ts <= toDateTime('{}')
                    GROUP BY node_id
                    UNION ALL
                    SELECT
                        to_node_id AS node_id,
                        max(ts) AS last_activity
                    FROM edges_by_minute_mv
                    WHERE project_id = {} AND ts >= toDateTime('{}') AND ts <= toDateTime('{}')
                    GROUP BY node_id
                ) s
                GROUP BY s.node_id
            ) s
            JOIN nodes ON s.node_id = nodes.node_id
            ",
            project_id,
            start_date_bound.format("%Y-%m-%d %H:%M:%S"),
            end_date_bound.format("%Y-%m-%d %H:%M:%S"),
            project_id,
            start_date_bound.format("%Y-%m-%d %H:%M:%S"),
            end_date_bound.format("%Y-%m-%d %H:%M:%S"),
        ))
        .fetch_all()
        .await?;

    let mut nodes = Vec::new();

    for row in block.rows() {
        let ts: DateTime<Tz> = row.get("last_activity")?;
        nodes.push(NodeActivity {
            node: Node {
                node_id: row.get("node_id")?,
                node_type: NodeType::from_u8(row.get("node_type")?),
                name: row.get("node_name")?,
                parent_id: row.get("node_parent_id")?,
            },
            last_activity: ts.with_timezone(&Utc),
        });
    }

    Ok(ActiveNodes { nodes })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::payloads::{EdgeStatus, NodeType};
    use chrono::{DateTime, NaiveDateTime, Utc};
    use rand::prelude::*;
    use uuid::Uuid;

    fn create_nodes() -> Vec<Node> {
        let mut parents = vec![];
        for i in 0..5 {
            parents.push(Node {
                node_id: Uuid::new_v4(),
                node_type: NodeType::Service,
                name: format!("service_{}", i),
                parent_id: None,
            })
        }

        let mut children = vec![];
        let mut rng = rand::thread_rng();
        for i in 0..10 {
            let parent_id = parents[rng.gen_range(0..parents.len())].node_id;
            children.push(Node {
                node_id: Uuid::new_v4(),
                node_type: NodeType::Transaction,
                name: format!("transaction_{}", i),
                parent_id: Some(parent_id),
            });
        }

        parents.append(&mut children);
        parents
    }

    fn create_edges(nodes: &Vec<Node>) -> Vec<Edge> {
        let mut edges: Vec<Edge> = vec![];
        let mut rng = rand::thread_rng();

        for _ in 1..100 {
            // this doesn't guard against circular references at all
            let to_node_id = nodes[rng.gen_range(0..nodes.len())].node_id;
            let from_node_id = nodes[rng.gen_range(0..nodes.len())].node_id;

            let count = rng.gen_range(0..500);
            let status = EdgeStatus::from_u8(rng.gen_range(1..3));

            let now_s = Utc::now().with_timezone(&Tz::UTC).timestamp();
            // 60s * 60min * 3h
            let timestamp = rng.gen_range(now_s - 10800..now_s);
            let ts = DateTime::<Utc>::from_utc(NaiveDateTime::from_timestamp(timestamp, 0), Utc);
            edges.push(Edge {
                ts,
                from_node_id,
                to_node_id,
                status,
                n: count,
            });
        }
        edges
    }

    #[tokio::test]
    async fn test_register_node() {
        let nodes = create_nodes();

        let mut client = get_client().await.unwrap();
        register_nodes(&mut client, 1, &nodes).await.unwrap();
    }

    #[tokio::test]
    async fn test_insert_connections() {
        let nodes = create_nodes();
        let mut client = get_client().await.unwrap();
        register_nodes(&mut client, 1, &nodes).await.unwrap();

        let edges = create_edges(&nodes);

        let mut client = get_client().await.unwrap();
        register_edges(&mut client, 1, &edges).await.unwrap();
        let results = query_graph(&mut client, 1, None, None).await.unwrap();
        assert!(!results.edges.is_empty());
        assert!(!results.nodes.is_empty());
        let empty_results = query_graph(
            &mut client,
            1,
            Some(Utc::now() - Duration::weeks(20)),
            Some(Utc::now() - Duration::weeks(19)),
        )
        .await
        .unwrap();
        assert!(empty_results.edges.is_empty());
        assert!(empty_results.nodes.is_empty());
    }
}
