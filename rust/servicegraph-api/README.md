# Api Server

To run:

```
cargo run
```

go to `localhost:8000` to see what's running


## Graph API

This endpoint returns the graph of service calls to the client (currently mock data)

```
GET localhost:8000/graph/420

{
    "adjacency_map": {
        "418f3d00-ba14-42eb-98b8-5f3fb1b975c8": [
            {
                "to_node": "5042546b-07a0-41d4-a73c-9138722eebb4",
                "hitcount": 12
            },
            {
                "to_node": "9ac770a6-0a2b-4805-b506-d87ba2510102",
                "hitcount": 420
            }
        ]
    },
    "metadata": {
        "5042546b-07a0-41d4-a73c-9138722eebb4": {
            "name": "ServiceB",
            "description": "dependent service",
            "uuid": "5042546b-07a0-41d4-a73c-9138722eebb4"
        },
        "9ac770a6-0a2b-4805-b506-d87ba2510102": {
            "name": "ServiceC",
            "description": "other service",
            "uuid": "9ac770a6-0a2b-4805-b506-d87ba2510102"
        },
        "418f3d00-ba14-42eb-98b8-5f3fb1b975c8": {
            "name": "ServiceA",
            "description": "root service",
            "uuid": "418f3d00-ba14-42eb-98b8-5f3fb1b975c8"
        }
    }
}
```
