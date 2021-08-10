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
    status_ok UInt32,
    status_expected_error UInt32,
    status_unexpected_error UInt32
) ENGINE = SummingMergeTree()
ORDER BY checkin_time;


CREATE MATERIALIZED VIEW IF NOT EXISTS servicegraph.edges_by_minute_mv TO servicegraph.edges_by_minute (
    project_id UInt64,
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    status_ok UInt32,
    status_expected_error UInt32,
    status_unexpected_error UInt32
)
AS SELECT
    project_id,
    toStartOfMinute(checkin_time) AS checkin_time,
    from_node_id,
    to_node_id,
    sumIf(n, status = 1) as status_ok,
    sumIf(n, status = 2) as status_expected_error,
    sumIf(n, status = 3) as status_unexpected_error
FROM servicegraph.edges
GROUP BY project_id, from_node_id, to_node_id, checkin_time;
