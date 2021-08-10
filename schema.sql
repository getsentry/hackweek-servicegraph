CREATE DATABASE IF NOT EXISTS servicegraph;

CREATE TABLE IF NOT EXISTS servicegraph.nodes (
    id UUID,
    service_name LowCardinality(String),
    -- transaction is optional, empty string means none
    transaction_name LowCardinality(String),
    description String,
    timestamp DateTime
) ENGINE = ReplacingMergeTree()
ORDER BY (service_name, transaction_name, id);

CREATE TABLE IF NOT EXISTS servicegraph.connections (
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    src_status UInt8,
    n UInt32
) ENGINE = MergeTree()
PARTITION BY (toYYYYMMDD(checkin_time), from_node_id)
ORDER BY checkin_time;

CREATE TABLE IF NOT EXISTS servicegraph.connections_by_minute (
    -- timestamp bucketed by minute
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    n UInt32
) ENGINE = SummingMergeTree()
ORDER BY checkin_time;


CREATE MATERIALIZED VIEW IF NOT EXISTS servicegraph.connections_by_minute_mv TO servicegraph.connections_by_minute (
    checkin_time DateTime,
    from_node_id UUID,
    to_node_id UUID,
    n UInt32
)
AS SELECT toStartOfMinute(checkin_time) AS checkin_time, from_node_id, to_node_id, sum(n) as n
FROM servicegraph.connections
GROUP BY from_node_id, to_node_id, checkin_time;
