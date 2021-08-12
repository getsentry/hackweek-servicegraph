use std::collections::{BTreeSet, HashMap};
use std::fmt::Write;

use chrono::Utc;
use chrono::{DateTime, Duration};
use chrono_tz::Tz;
use clickhouse_rs::types::{Complex, Row};
use clickhouse_rs::{Block, ClientHandle, Pool};
use lazy_static::lazy_static;
use uuid::Uuid;

use crate::error::Error;
use crate::payloads::{
    ActiveNodes, Bucket, CombinedEdge, CommonQueryParams, Edge, EdgeStatus, Graph,
    GraphQueryParams, Histogram, Node, NodeActivity, NodeQueryParams, NodeType, NodeWithStatus,
};

lazy_static! {
    static ref CLICKHOUSE_POOL: Pool =
        Pool::new("tcp://localhost:9000/servicegraph?compression=lz4");
}

pub async fn get_client() -> Result<ClientHandle, Error> {
    Ok(CLICKHOUSE_POOL.get_handle().await?)
}

macro_rules! colvec {
    ($source:expr, $expr:expr) => {
        $source.iter().map($expr).collect::<Vec<_>>()
    };
}

pub async fn register_nodes(
    client: &mut ClientHandle,
    project_id: u64,
    nodes: &[Node],
) -> Result<(), Error> {
    let now = Utc::now().with_timezone(&Tz::UTC);
    let block = Block::new()
        .column("project_id", vec![project_id; nodes.len()])
        .column("node_id", colvec!(nodes, |x| x.node_id))
        .column("node_type", colvec!(nodes, |x| x.node_type.as_u8()))
        .column("name", colvec!(nodes, |x| x.name.clone()))
        .column("parent_id", colvec!(nodes, |x| x.parent_id))
        .column("ts", vec![now; nodes.len()]);
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
        .column("ts", colvec!(edges, |x| x.ts.with_timezone(&Tz::UTC)))
        .column("from_node_id", colvec!(edges, |x| x.from_node_id))
        .column("to_node_id", colvec!(edges, |x| x.to_node_id))
        .column("status", colvec!(edges, |x| x.status.as_u8()))
        .column("n", colvec!(edges, |x| x.n));
    client.insert("edges", block).await?;
    Ok(())
}

fn default_date_range(params: &CommonQueryParams) -> (DateTime<Utc>, DateTime<Utc>) {
    (
        match params.start_date {
            Some(s) => s,
            None => Utc::now() - Duration::hours(1),
        },
        match params.end_date {
            Some(s) => s,
            None => Utc::now(),
        },
    )
}

fn get_node_filter(types: &BTreeSet<NodeType>, field: &str) -> Result<String, Error> {
    let mut filter = String::new();
    if !types.is_empty() {
        filter.push('(');
        for (idx, ty) in types.iter().enumerate() {
            if idx > 0 {
                filter.push_str(" OR ");
            }
            write!(filter, "{} = {}", field, ty.as_u8())?;
        }
        filter.push(')');
    }
    Ok(filter)
}

fn get_edge_post_filter(edge_statuses: &BTreeSet<EdgeStatus>) -> Result<String, Error> {
    let mut filter = String::new();
    if !edge_statuses.is_empty() {
        filter.push('(');
        for (idx, es) in edge_statuses.iter().enumerate() {
            if idx > 0 {
                filter.push_str(" OR ");
            }
            let clause = match es {
                EdgeStatus::Ok => "t.status_ok > 0",
                EdgeStatus::ExpectedError => "t.status_expected_error > 0",
                EdgeStatus::UnexpectedError => "t.status_unexpected_error > 0",
            };
            filter.push_str(clause);
        }
        filter.push(')');
    }
    Ok(filter)
}

fn and_if_filter(filter: &String) -> &str {
    return if filter.is_empty() { "" } else { "AND " };
}

fn node_from_row(row: &Row<Complex>, prefix: &str) -> Result<Node, Error> {
    Ok(Node {
        node_id: row.get(format!("{}node_id", prefix).as_str())?,
        node_type: NodeType::from_u8(row.get(format!("{}node_type", prefix).as_str())?),
        name: row.get(format!("{}node_name", prefix).as_str())?,
        description: row.get(format!("{}node_description", prefix).as_str())?,
        class: row.get(format!("{}node_class", prefix).as_str())?,
        parent_id: row.get(format!("{}node_parent_id", prefix).as_str())?,
    })
}

pub async fn query_graph(
    client: &mut ClientHandle,
    params: &GraphQueryParams,
) -> Result<Graph, Error> {
    let (start_date_bound, end_date_bound) = default_date_range(params);

    let from_node_filter = get_node_filter(&params.from_types, "from_node.node_type")?;
    let to_node_filter = get_node_filter(&params.to_types, "to_node.node_type")?;
    let edge_post_filter = get_edge_post_filter(&params.edge_statuses)?;
    let base_query = format!(
        r#"
        SELECT
            edges.from_node_id as from_node_id,
            from_node.name as from_node_name,
            from_node.node_type as from_node_type,
            from_node.parent_id as from_node_parent_id,
            argMax(from_node.description, from_node.ts) as from_node_description,
            argMax(from_node.class, from_node.ts) as from_node_class,
            edges.to_node_id as to_node_id,
            to_node.name as to_node_name,
            to_node.node_type as to_node_type,
            from_node.parent_id as to_node_parent_id,
            argMax(to_node.description, to_node.ts) as to_node_description,
            argMax(to_node.class, to_node.ts) as to_node_class,
            argMax(edges.description, edges.ts) as edge_description,
            argMax(edges.class, edges.ts) as edge_class,
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
      WHERE edges.project_id = {project_id}
        AND edges.ts >= toDateTime('{start_date}')
        AND edges.ts <= toDateTime('{end_date}')
        {to_node_filter_and}{to_node_filter}
        {from_node_filter_and}{from_node_filter}
   GROUP BY from_node_id,
            from_node_name,
            from_node_type,
            from_node_parent_id,
            to_node_id,
            to_node_name,
            to_node_type,
            to_node_parent_id"#,
        project_id = params.project_id,
        start_date = start_date_bound.format("%Y-%m-%d %H:%M:%S"),
        end_date = end_date_bound.format("%Y-%m-%d %H:%M:%S"),
        to_node_filter_and = and_if_filter(&to_node_filter),
        to_node_filter = to_node_filter,
        from_node_filter_and = and_if_filter(&from_node_filter),
        from_node_filter = from_node_filter,
    );

    let block = client
        .query(&format!(
            r#"
                SELECT
                    t.from_node_id as from_node_id,
                    t.from_node_name as from_node_name,
                    t.from_node_type as from_node_type,
                    t.from_node_parent_id as from_node_parent_id,
                    t.from_node_description as from_node_description,
                    t.from_node_class as from_node_class,
                    t.to_node_id as to_node_id,
                    t.to_node_name as to_node_name,
                    t.to_node_type as to_node_type,
                    t.to_node_parent_id as to_node_parent_id,
                    t.to_node_description as to_node_description,
                    t.to_node_class as to_node_class,
                    t.edge_description as edge_description,
                    t.edge_class as edge_class,
                    t.status_ok as status_ok,
                    t.status_expected_error as status_expected_error,
                    t.status_unexpected_error as status_unexpected_error
                FROM
                    ({base_query}) AS t
                {where_clause}
                "#,
            base_query = base_query,
            where_clause = if !edge_post_filter.is_empty() {
                format!("WHERE {}", edge_post_filter)
            } else {
                String::from("")
            }
        ))
        .fetch_all()
        .await?;

    let mut edges = Vec::new();
    let mut nodes = HashMap::new();

    let mut node_statuses: HashMap<Uuid, (u32, u32, u32)> = HashMap::new();

    for row in block.rows() {
        let status_ok = row.get("status_ok")?;
        let status_expected_error = row.get("status_expected_error")?;
        let status_unexpected_error = row.get("status_unexpected_error")?;
        let edge = CombinedEdge {
            from_node_id: row.get("from_node_id")?,
            to_node_id: row.get("to_node_id")?,
            description: row.get("edge_description")?,
            class: row.get("edge_class")?,
            status_ok: status_ok,
            status_expected_error: status_expected_error,
            status_unexpected_error: status_unexpected_error,
        };
        edges.push(edge);

        let from_node = node_from_row(&row, "from_")?;
        let from_node_id = from_node.node_id;
        nodes.insert(from_node.node_id, from_node);
        let to_node = node_from_row(&row, "to_")?;
        let to_node_id = to_node.node_id;
        nodes.insert(to_node_id, to_node);

        let prev_to_status = node_statuses.get(&to_node_id).unwrap_or(&(0, 0, 0));
        let to_status = (
            prev_to_status.0 + status_ok,
            prev_to_status.1 + status_expected_error,
            prev_to_status.2 + status_unexpected_error,
        );
        node_statuses.insert(to_node_id, to_status);

        let prev_from_status = node_statuses.get(&from_node_id).unwrap_or(&(0, 0, 0));
        let from_status = (
            prev_from_status.0 + 0,
            prev_from_status.1 + 0,
            prev_from_status.2 + 0,
        );

        node_statuses.insert(from_node_id, from_status);
    }

    let mut nodes_with_status = HashMap::new();

    for (node_id, node) in nodes {
        let status = node_statuses.get(&node_id).unwrap_or(&(0, 0, 0));
        let node_with_status = NodeWithStatus {
            node: node,
            status_ok: status.0,
            status_expected_error: status.1,
            status_unexpected_error: status.2,
        };
        nodes_with_status.insert(node_id, node_with_status);
    }

    Ok(Graph {
        edges,
        nodes: nodes_with_status.into_values().collect(),
    })
}

pub async fn query_active_nodes(
    client: &mut ClientHandle,
    params: &NodeQueryParams,
) -> Result<ActiveNodes, Error> {
    let (start_date_bound, end_date_bound) = default_date_range(params);
    let edge_filter = format!(
        "project_id = {} AND ts >= toDateTime('{}') AND ts <= toDateTime('{}')",
        params.project_id,
        start_date_bound.format("%Y-%m-%d %H:%M:%S"),
        end_date_bound.format("%Y-%m-%d %H:%M:%S"),
    );
    let mut node_filter = get_node_filter(&params.types, "nodes.node_type")?;
    if node_filter.is_empty() {
        node_filter.push_str("1 = 1");
    }

    let block = client
        .query(&format!(
            r#"
            SELECT
                s.node_id as node_id,
                s.last_activity as last_activity,
                nodes.name as node_name,
                nodes.node_type as node_type,
                nodes.parent_id as node_parent_id,
                nodes.description as node_description,
                nodes.class as node_class
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
                    WHERE {edge_filter}
                    GROUP BY node_id
                    UNION ALL
                    SELECT
                        to_node_id AS node_id,
                        max(ts) AS last_activity
                    FROM edges_by_minute_mv
                    WHERE {edge_filter}
                    GROUP BY node_id
                ) s
                GROUP BY s.node_id
            ) s
            JOIN nodes ON s.node_id = nodes.node_id
            WHERE {node_filter}
            "#,
            edge_filter = edge_filter,
            node_filter = node_filter
        ))
        .fetch_all()
        .await?;

    let mut nodes = Vec::new();

    for row in block.rows() {
        let ts: DateTime<Tz> = row.get("last_activity")?;
        nodes.push(NodeActivity {
            node: node_from_row(&row, "")?,
            last_activity: ts.with_timezone(&Utc),
        });
    }

    Ok(ActiveNodes { nodes })
}

pub async fn query_histogram(
    client: &mut ClientHandle,
    params: &CommonQueryParams,
) -> Result<Histogram, Error> {
    let (start_date_bound, end_date_bound) = default_date_range(params);
    let block = client
        .query(&format!(
            r#"
            SELECT
                ts,
                plus(plus(sumIfMerge(status_ok), sumIfMerge(status_expected_error)), sumIfMerge(status_unexpected_error)) as count
            FROM edges_by_minute
            WHERE project_id = {project_id}
            AND ts >= toDateTime('{start_date}')
            AND ts <= toDateTime('{end_date}')
            GROUP BY ts
            ORDER BY ts
            "#,
            project_id = params.project_id,
            start_date = start_date_bound.format("%Y-%m-%d %H:%M:%S"),
            end_date = end_date_bound.format("%Y-%m-%d %H:%M:%S"),
        ))
        .fetch_all()
        .await?;

    let mut buckets = Vec::new();

    for row in block.rows() {
        let ts: DateTime<Tz> = row.get("ts")?;
        buckets.push(Bucket {
            ts: ts.with_timezone(&Utc),
            n: row.get("count")?,
        });
    }

    Ok(Histogram { buckets: buckets })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::payloads::{CommonQueryParams, EdgeStatus, NodeType};
    use chrono::{DateTime, NaiveDateTime, Utc};
    use rand::prelude::*;
    use uuid::Uuid;

    fn create_nodes() -> Vec<Node> {
        let mut parents = vec![];
        let mut children = vec![];
        for children_count in 0..5 {
            let node = Node {
                node_id: Uuid::new_v4(),
                node_type: NodeType::Service,
                name: format!("service_{}", children_count),
                description: None,
                class: None,
                parent_id: None,
            };
            match children_count {
                0 => {}
                // 1 kid
                1 | 5 => {
                    children.push(Node {
                        node_id: Uuid::new_v4(),
                        node_type: NodeType::Transaction,
                        name: format!("transaction_{}", children.len()),
                        description: None,
                        class: None,
                        parent_id: Some(node.node_id),
                    });
                }
                // 2 kids
                2 | 4 => {
                    for _ in 0..1 {
                        children.push(Node {
                            node_id: Uuid::new_v4(),
                            node_type: NodeType::Transaction,
                            name: format!("transaction_{}", children.len()),
                            description: None,
                            class: None,
                            parent_id: Some(node.node_id),
                        });
                    }
                }
                // 3 kids
                _ => {
                    for _ in 0..2 {
                        children.push(Node {
                            node_id: Uuid::new_v4(),
                            node_type: NodeType::Transaction,
                            name: format!("transaction_{}", children.len()),
                            description: None,
                            class: None,
                            parent_id: Some(node.node_id),
                        });
                    }
                }
            }
            parents.push(node);
        }
        parents.append(&mut children);
        parents
    }
    enum EdgeTypes {
        ServiceToService,
        ServiceToTransaction,
        TransactionToTransaction,
    }

    impl EdgeTypes {
        fn from_u8(value: u8) -> EdgeTypes {
            match value {
                0 => EdgeTypes::ServiceToService,
                1 => EdgeTypes::ServiceToTransaction,
                _ => EdgeTypes::TransactionToTransaction,
            }
        }
    }

    fn create_edges(nodes: &[Node]) -> Vec<Edge> {
        let mut edges: Vec<Edge> = vec![];
        let mut rng = rand::thread_rng();

        // a really shitty way to track existing T->T edges
        let mut existing_tt_edges: Vec<_> = vec![];

        let (services, transactions): (Vec<&Node>, Vec<&Node>) = nodes
            .iter()
            .partition(|node| matches!(node.node_type, NodeType::Service));

        let random_service =
            |rng: &mut ThreadRng| services[rng.gen_range(0..services.len())].node_id;

        let random_transaction = |rng: &mut ThreadRng| {
            let transaction = transactions[rng.gen_range(0..transactions.len())];
            let service = services
                .iter()
                .find(|s| s.node_id == transaction.parent_id.unwrap())
                .unwrap();
            (transaction.node_id, service.node_id)
        };

        for _ in 0..15 {
            let edge_type = EdgeTypes::from_u8(rng.gen_range(0..=3) as u8);
            let (to_node_id, from_node_id, extra_edge) = match edge_type {
                EdgeTypes::ServiceToService => {
                    let src_service = random_service(&mut rng);
                    let dst_service = random_service(&mut rng);
                    (src_service, dst_service, None)
                }
                EdgeTypes::ServiceToTransaction => {
                    let src_service = random_service(&mut rng);
                    let (dst_transaction, dst_service) = random_transaction(&mut rng);
                    (
                        src_service,
                        dst_transaction,
                        Some((src_service, dst_service)),
                    )
                }
                EdgeTypes::TransactionToTransaction => {
                    let (src_transaction, src_service) = random_transaction(&mut rng);
                    let (mut dst_transaction, _) = random_transaction(&mut rng);
                    // no "recursive" transactions
                    while dst_transaction == src_transaction
                        || existing_tt_edges.contains(&(src_transaction, dst_transaction))
                    {
                        dst_transaction = random_transaction(&mut rng).0;
                    }

                    existing_tt_edges.push((src_transaction, dst_transaction));
                    existing_tt_edges.push((dst_transaction, src_transaction));
                    (
                        src_transaction,
                        dst_transaction,
                        Some((src_service, dst_transaction)),
                    )
                }
            };

            let count = rng.gen_range(0..500);
            let status = EdgeStatus::from_u8(rng.gen_range(1..3));

            let now_s = Utc::now().with_timezone(&Tz::UTC).timestamp();
            // 60s * 60min * 1h
            let timestamp = rng.gen_range(now_s - 3600..now_s);
            let ts = DateTime::<Utc>::from_utc(NaiveDateTime::from_timestamp(timestamp, 0), Utc);

            edges.push(Edge {
                ts,
                from_node_id,
                to_node_id,
                status,
                description: Some("calls".into()),
                class: None,
                n: count,
            });

            // if it's a transaction -> transaction then the src transaction
            // also needs an edge between its service and the destination's transaction
            // this does not prevent cycles
            if let Some((src, dst)) = extra_edge {
                edges.push(Edge {
                    ts,
                    from_node_id: src,
                    to_node_id: dst,
                    status,
                    description: Some("calls".into()),
                    class: None,
                    n: count,
                });
            }
        }
        edges
    }

    // #[tokio::test]
    // async fn test_register_nodes() {
    //     let nodes = create_nodes();

    //     let mut client = get_client().await.unwrap();
    //     register_nodes(&mut client, 1, &nodes).await.unwrap();

    //     // todo: check nodes somehow
    // }

    #[tokio::test]
    async fn test_insert_connections() {
        let nodes = create_nodes();
        let mut client = get_client().await.unwrap();
        register_nodes(&mut client, 1, &nodes).await.unwrap();

        let edges = create_edges(&nodes);

        let mut client = get_client().await.unwrap();
        register_edges(&mut client, 1, &edges).await.unwrap();
        let results = query_graph(
            &mut client,
            &GraphQueryParams {
                common: CommonQueryParams {
                    project_id: 1,
                    ..Default::default()
                },
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert!(!results.edges.is_empty());
        assert!(!results.nodes.is_empty());
        let empty_results = query_graph(
            &mut client,
            &GraphQueryParams {
                common: CommonQueryParams {
                    project_id: 1,
                    start_date: Some(Utc::now() - Duration::weeks(20)),
                    end_date: Some(Utc::now() - Duration::weeks(19)),
                },
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert!(empty_results.edges.is_empty());
        assert!(empty_results.nodes.is_empty());
    }
}
