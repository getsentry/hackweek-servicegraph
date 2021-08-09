# hackweek-servicegraph

servicegraph is a simple system that helps creating a map of interactions of different
pieces in a system and how it behaves.

## Summary

Each participant in the system reports to a central service its observations of
connections in the graph. It effectively reports what it talked to, why and how
this went.

## Nodes

Nodes need to know who they are. All nodes need to be registered with the graph
service so metadata is held.

At the moment the system only describes registered nodes. That means only
connections between nodes are permissible that first registered themselves
under `/identify`. Most importantly this means you cannot yet describe
connections to external services.

### Node Scopes

Nodes of different scopes are strictly nested. We only defined two levels:
`service` which is a service (like a web application, database server etc.)
and `transaction` which is a node underneath. A `transaction` exists within
a `service` always. A `transaction` without service is not permissible.

Scopes in the protocol formatted as such:

```
service
service/transaction
```

We reserve `service@host` and `service@host/transaction` for future extensions.

Because scopes are nested, connections can be made between services or
transactions. If a service talks to a transaction it implicitly also conencts
to the service.

### Temporal Nature

For simplicity reasons everything is time based within a one minute bucket.

### Node Registration

When a service or transaction first reports a connection it needs to know the IDs
of the nodes. IDs can be rolled by the application itself. It's free to define the
IDs itself as it wants and report them even before reporting them to the servicegraph
as a node but until the node is registered they won't be queryable.

```yaml
POST /submit
Content-Type: application/json

{
  "project_id": 42,  # the id of project to report to
  "nodes": [
    {
      "node_id": "NODE_ID as guid",
      "name": "human readable name of the node reported in the UI",
      "description": "human readable extended description for the UI",
      "type": "service | transaction",
      "parent_id": "id of the parent node (eg: service node id) for transactions"
    }
  ]
}
```

### Node ID Communication

When a `from` node sends a request to a `to` node, the `to` node should report the
IDs as a response headers called `servicegraph-context` in the following format:

```
servicegraph-context: service-node=SERVICE_ID transaction-node=TRANSACTION_ID
```

### Node Registry

The servicegraph reports nodes in a somewhat mutable data store. Multiple
descriptions of the same node can be merged into one. A node is given a UUID
which identifies it internally in the system.

## Reporting Connections

To report connections one submits the edges between nodes in the graph.

```yaml
POST /submit
Content-Type: application/json
{
  "project_id": 42,  # the id of project to report to
  "edges": [
    {
      "ts": "2021-06-09T00:00:00Z",
      "from": "FROM_NODE_ID",
      "to": "TO_NODE_ID",
      "status": "status code",
      "n": "how many times did this happen"
    }
  ]
}
```

**Status**:

The following status flags can exist:

- `ok`: the connection was healthy
- `expected_error`: the connection encountered an expected error (eg: failure response)
- `unexpected_error`: the connection encountered un unexpected error (eg: internal server error)
- `fatal`: the connection failed in a fatal way (eg: service unreachable)
