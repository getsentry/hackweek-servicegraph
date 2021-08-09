# hackweek-servicegraph

servicegraph is a simple system that helps creating a map of interactions of different
pieces in a system and how it behaves.

## Summary

Each participant in the system reports to a central service its observations of
connections in the graph. It effectively reports what it talked to, why and how
this went.

## Scopes

Scopes are strictly nested. A _host_ contains _services_ each of which consists
of multiple _transactions_.

- `host`: this is a logical host
- `service`: a service represents a logical piece of software that does something
- `transaction`: a transaction is a part of a service that represents some work

Scopes in the protocol formatted as such:

```
host
service@host
service@host/transaction
```

Because scopes are nested connections can be made between hosts, services or
transactions. If a service talks to a transaction it implicitly also conencts
to the host and service.

## Temporal Nature

For simplicity reasons everything is time based within a one minute bucket.

## Nodes

Nodes need to know who they are. As per policy host and service level nodes
need to be registered, transactions should not be. That's because transactions
look the same for both sides of a connection, but services and hosts do not.

### Host Registration

When a host first reports it needs to know its ID. For this it registers
itself with the API:

```yaml
POST /identify
Content-Type: application/json

{
  # this registers a host
  "host": {
    "hostname": "self reported host name",
    "ip": "locally observed ip address",
    "port": "locally observed port if available",
    "type": "what type of host am I",
    "description": "human readable description"
  }
}
```

The response is the registered node ID. From now on responses from this service
should pass the node ID around. For instance via HTTP the `x-servicegraph-node-id`
header shall be used.

### Service Registration

When a service first reports it needs to know its ID. For this it registers
itself with the API:

```yaml
POST /identify
Content-Type: application/json

{
  # this registers a service
  "service": {
    "name": "my-service",
    "host_node_id": "node-id of the host we're running on",
    "type": "what type of service am i",
    "description": "human readable description"
  }
}
```

The response is the registered node ID. From now on responses from this service
should pass the node ID around. For instance via HTTP the `x-servicegraph-node-id`
header shall be used.

## Node Descriptors

Node descriptors are strings like this:

```yaml
# a registered node
node:NODE_ID

# a transaction on a registered node
node:NODE_ID/transaction-name

# an unknown http service
http:host-name

# an unknown http service with an endpoint
http:host-name/endpoint
```

## Node Database

The servicegraph reports nodes in a somewhat mutable data store. Multiple
descriptions of the same node can be merged into one. A node is given a UUID
which identifies it internally in the system.

## Reporting Connections

Reporting of connections between two instrumented node:

```yaml
POST /connections
Content-Type: application/json
{
  "connections": {
    # all connections in a 60 second window
    "2021-06-09T00:00:00Z": [
      {
        "from": "descriptor of from side",
        "to": "descriptor of to side",
        "n": "how many times did this happen?",
        "status": "status enum"
      }
    ]
  }
}
```
