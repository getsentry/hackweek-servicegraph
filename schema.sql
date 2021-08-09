CREATE DATABASE IF NOT EXISTS servicegraph;

-- For now nodes just map UUID to service names
-- Hosts and other stuff to be added later
CREATE TABLE IF NOT EXISTS servicegraph.nodes (
    id UUID,
    service_name String,
    timestamp DateTime
) ENGINE = ReplacingMergeTree()
ORDER BY (id, timestamp);

-- CREATE TABLE IF NOT EXISTS servicegraph.connections (
--     -- the timestamp of the checkin
--     checkin_time DateTime,
--     -- the window size of the checkin in 10 second multiples.
--     checkin_window UInt8,
--     -- the id of the source scope
--     src_scope UUID,
--     -- the id of the destination scope
--     dst_scope UUID,
--     -- the status flag of the source
--     src_status UInt8,
--     -- the status flag of the destination as observed by the source
--     src_observed_dst_status UInt8,
--     -- the type ID of the source
--     src_type UInt16,
--     -- the type ID of the destination (as reported by the source)
--     dst_type UInt16,
--     -- the load in the range of 0-255
--     src_load UInt8,
--     -- the type ID of the operation
--     op_type UInt16,
--     -- the N value of the operation (types the operation was performed)
--     op_n UInt32,
--     -- human readable source description
--     src_description String,
--     -- human readable destination description
--     dst_description String,
--     -- human readable operation description
--     op_description String
-- ) ENGINE = MergeTree()
-- PARTITION BY (toYYYYMMDD(checkin_time), src_scope)
-- ORDER BY checkin_time;