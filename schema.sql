CREATE DATABASE IF NOT EXISTS servicegraph;

CREATE TABLE IF NOT EXISTS servicegraph.nodes (
    project_id UInt64,
    node_id UUID,
    node_type UInt8,
    name LowCardinality(String),
    timestamp DateTime
) ENGINE = ReplacingMergeTree()
ORDER BY (timestamp, project_id, name, node_id);

CREATE TABLE IF NOT EXISTS servicegraph.edges (
    project_id UInt64,
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    status UInt8,
    n UInt32
) ENGINE = MergeTree()
PARTITION BY (toYYYYMMDD(checkin_time), project_id, from_node_id)
ORDER BY checkin_time;

CREATE TABLE IF NOT EXISTS servicegraph.edges_by_minute (
    -- timestamp bucketed by minute
    project_id UInt64,
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    n UInt32
) ENGINE = SummingMergeTree()
ORDER BY checkin_time;


CREATE MATERIALIZED VIEW IF NOT EXISTS servicegraph.edges_by_minute_mv TO servicegraph.edges_by_minute (
    project_id UInt64,
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    n UInt32
)
AS SELECT
    project_id,
    toStartOfMinute(checkin_time) AS checkin_time,
    from_node_id,
    to_node_id,
    sum(n) as n
FROM servicegraph.edges
GROUP BY project_id, from_node_id, to_node_id, checkin_time;
