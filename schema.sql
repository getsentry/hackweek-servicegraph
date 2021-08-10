CREATE DATABASE IF NOT EXISTS servicegraph;

CREATE TABLE IF NOT EXISTS servicegraph.nodes (
    node_id UUID,
    node_type UInt8,
    name String,
    timestamp DateTime
) ENGINE = ReplacingMergeTree()
ORDER BY (timestamp, name, node_id);

CREATE TABLE IF NOT EXISTS servicegraph.edges (
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    status UInt8,
    n UInt32
) ENGINE = MergeTree()
PARTITION BY (toYYYYMMDD(checkin_time), from_node_id)
ORDER BY checkin_time;

CREATE TABLE IF NOT EXISTS servicegraph.edges_by_minute (
    -- timestamp bucketed by minute
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    n UInt32
) ENGINE = SummingMergeTree()
ORDER BY checkin_time;


CREATE MATERIALIZED VIEW IF NOT EXISTS servicegraph.edges_by_minute_mv TO servicegraph.edges_by_minute (
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    n UInt32
)
AS SELECT toStartOfMinute(checkin_time) AS checkin_time, from_node_id, to_node_id, sum(n) as n
FROM servicegraph.edges
GROUP BY from_node_id, to_node_id, checkin_time;
