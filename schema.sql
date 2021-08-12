CREATE DATABASE IF NOT EXISTS servicegraph;

CREATE TABLE IF NOT EXISTS servicegraph.nodes (
    project_id UInt64,
    node_id UUID,
    node_type UInt8,
    name LowCardinality(String),
    description Nullable(String),
    class Nullable(String),
    parent_id Nullable(UUID),
    ts DateTime
) ENGINE = ReplacingMergeTree(ts)
ORDER BY (project_id, node_id)
TTL ts + toIntervalDay(90);

CREATE TABLE IF NOT EXISTS servicegraph.edges (
    project_id UInt64,
    ts DateTime,
    from_node_id UUID,
    to_node_id UUID,
    description Nullable(String),
    class Nullable(String),
    status UInt8,
    n UInt32
) ENGINE = MergeTree()
PARTITION BY (toYYYYMMDD(ts), project_id, from_node_id)
ORDER BY (project_id, ts)
TTL ts + toIntervalDay(90);

CREATE TABLE IF NOT EXISTS servicegraph.edges_by_minute (
    -- timestamp bucketed by minute
    project_id UInt64,
    ts DateTime,
    from_node_id UUID,
    to_node_id UUID,
    description Nullable(String),
    class Nullable(String),
    status_ok AggregateFunction(sumIf, UInt32, UInt8),
    status_expected_error AggregateFunction(sumIf, UInt32, UInt8),
    status_unexpected_error AggregateFunction(sumIf, UInt32, UInt8)
) ENGINE = AggregatingMergeTree()
ORDER BY (project_id, ts, from_node_id, to_node_id)
TTL ts + toIntervalDay(90);


CREATE MATERIALIZED VIEW IF NOT EXISTS servicegraph.edges_by_minute_mv TO servicegraph.edges_by_minute
AS SELECT
    project_id,
    toStartOfMinute(ts) AS ts,
    from_node_id,
    to_node_id,
    argMax(description, ts) as description,
    argMax(class, ts) as class,
    sumIfState(n, status = 1) as status_ok,
    sumIfState(n, status = 2) as status_expected_error,
    sumIfState(n, status = 3) as status_unexpected_error
FROM servicegraph.edges
GROUP BY project_id, from_node_id, to_node_id, ts;
