use std::cmp;
use std::collections::BTreeSet;

use rocket::serde::json::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::{self, get_client};
use crate::db::{register_edges, register_nodes};
use crate::error::ApiError;
use crate::payloads::{
    ActiveNodes, CombinedEdge, CommonQueryParams, Edge, Graph, GraphQueryParams, Histogram, Node,
    NodeQueryParams, NodeType, ServiceMap, ServiceMapQueryParams,
};

#[derive(Serialize, Deserialize)]
pub struct SubmitData {
    project_id: u64,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
}

#[get("/health")]
pub fn health() -> String {
    return String::from("OK");
}

#[post("/submit", format = "json", data = "<data>")]
pub async fn submit(data: Json<SubmitData>) -> Result<String, ApiError> {
    let mut client = get_client().await?;
    if !data.nodes.is_empty() {
        register_nodes(&mut client, data.project_id, &data.nodes).await?;
    }
    if !data.edges.is_empty() {
        register_edges(&mut client, data.project_id, &data.edges).await?;
    }
    Ok("".into())
}

#[post("/graph", format = "json", data = "<params>")]
pub async fn query_graph(params: Json<GraphQueryParams>) -> Result<Json<Graph>, ApiError> {
    let mut client = get_client().await?;
    Ok(Json(db::query_graph(&mut client, &params).await?))
}

#[post("/active-nodes", format = "json", data = "<params>")]
pub async fn query_active_nodes(
    params: Json<NodeQueryParams>,
) -> Result<Json<ActiveNodes>, ApiError> {
    let mut client = get_client().await?;
    Ok(Json(db::query_active_nodes(&mut client, &params).await?))
}

#[post("/service-map", format = "json", data = "<params>")]
pub async fn query_service_map(
    params: Json<ServiceMapQueryParams>,
) -> Result<Json<ServiceMap>, ApiError> {
    let mut client = get_client().await?;

    let graph = db::query_graph(&mut client, &params.clone().into()).await?;
    let active_nodes = db::query_active_nodes(&mut client, &params.clone().into()).await?;

    let edges: Vec<CombinedEdge> = graph
        .edges
        .clone()
        .into_iter()
        .filter(|edge| {
            let source_node = graph
                .nodes
                .iter()
                .find(|node| node.node.node_id == edge.from_node_id);
            let target_node = graph
                .nodes
                .iter()
                .find(|node| node.node.node_id == edge.to_node_id);
            if let Some(source_node) = source_node {
                if let Some(target_node) = target_node {
                    let params_service_to_service = params.from_types.len() == 1
                        && params.from_types.contains(&NodeType::Service)
                        && params.to_types.len() == 1
                        && params.to_types.contains(&NodeType::Service);

                    let service_to_service = source_node.node.node_type == NodeType::Service
                        && target_node.node.node_type == NodeType::Service;
                    let service_to_transaction = source_node.node.node_type == NodeType::Service
                        && target_node.node.node_type == NodeType::Transaction;

                    let transaction_to_service = source_node.node.node_type
                        == NodeType::Transaction
                        && target_node.node.node_type == NodeType::Service;

                    if params_service_to_service && service_to_service {
                        return true;
                    }

                    if service_to_service || service_to_transaction {
                        return false;
                    }

                    if transaction_to_service {
                        let has_child = graph
                            .nodes
                            .iter()
                            .find(|node| {
                                if let Some(parent_id) = node.node.parent_id {
                                    return parent_id == target_node.node.node_id;
                                }
                                return false;
                            })
                            .is_some();
                        if has_child {
                            return false;
                        }
                    }
                }
            }
            return true;
        })
        .collect();

    // let keep_nodes: BTreeSet<Uuid> =
    //     edges
    //         .iter()
    //         .fold(BTreeSet::new(), |mut acc: BTreeSet<Uuid>, edge| {
    //             acc.insert(edge.from_node_id);
    //             acc.insert(edge.to_node_id);
    //             return acc;
    //         });

    // let nodes = graph
    //     .nodes
    //     .into_iter()
    //     .filter(|node| {
    //         return keep_nodes.contains(&node.node.node_id);
    //     })
    //     .collect();

    let graph = Graph {
        edges,
        nodes: graph.nodes,
    };

    if let Some(volume_filter) = params.traffic_volume {
        let mut volume_filter = cmp::min(volume_filter, 100);
        volume_filter = cmp::max(volume_filter, 0);

        if graph.edges.len() != 0 && volume_filter > 0 {
            let volume_filter = volume_filter as f64;
            let volumes: Vec<u32> = graph
                .edges
                .iter()
                .map(|edge| {
                    return edge.status_expected_error
                        + edge.status_ok
                        + edge.status_unexpected_error;
                })
                .collect();

            let min_volume = volumes.iter().min().unwrap();
            let max_volume = volumes.iter().max().unwrap();

            let mut keep_nodes: BTreeSet<Uuid> = BTreeSet::new();

            let edges: Vec<CombinedEdge> = graph
                .edges
                .into_iter()
                .filter(|edge| {
                    let edge_volume =
                        edge.status_expected_error + edge.status_ok + edge.status_unexpected_error;

                    if (max_volume - min_volume) == 0 {
                        return false;
                    }

                    let percentage =
                        (edge_volume - min_volume) as f64 / (max_volume - min_volume) as f64;
                    let percentage = percentage * 100.0;

                    let result = percentage >= volume_filter;

                    if result {
                        keep_nodes.insert(edge.from_node_id);
                        keep_nodes.insert(edge.to_node_id);
                    }

                    return result;
                })
                .collect();

            let nodes = graph
                .nodes
                .into_iter()
                .filter(|node| {
                    return keep_nodes.contains(&node.node.node_id);
                })
                .collect();

            let graph = Graph { edges, nodes };

            return Ok(Json(ServiceMap {
                graph,
                active_nodes,
            }));
        }
    }

    Ok(Json(ServiceMap {
        graph,
        active_nodes,
    }))
}

#[post("/histogram", format = "json", data = "<params>")]
pub async fn query_histogram(params: Json<CommonQueryParams>) -> Result<Json<Histogram>, ApiError> {
    let mut client = get_client().await?;

    Ok(Json(db::query_histogram(&mut client, &params).await?))
}
