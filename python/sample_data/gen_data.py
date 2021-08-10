import time
import uuid
import random
import requests
import json
import os

from datetime import datetime, timedelta, timezone

CUR_DIR = os.path.dirname(os.path.realpath(__file__))
SUBMIT_PAYLOAD = "localhost:8000/submit"

NUM_SERVICES = 10 
TRANSACTION_PER_SERVICE = 2 
NUM_TRANSACTIONS = NUM_SERVICES * TRANSACTION_PER_SERVICE
with open(f"{CUR_DIR}/animals.txt") as f:
    ANIMALS = [l.strip() for l in f.readlines()]
with open(f"{CUR_DIR}/adjectives.txt") as f:
    ADJECTIVES = [l.strip() for l in f.readlines()]
EDGES_PER_PERIOD = 1
PROJECT_ID = 1
FLUSH_INTERVAL_SECONDS = 10

def round_time(dt=None, round_to=FLUSH_INTERVAL_SECONDS):
   """Round a datetime object to any time lapse in seconds
   dt : datetime.datetime object, default now.
   roundTo : Closest number of seconds to round to, default 1 minute.
   """
   if dt == None : dt = datetime.now(timezone.utc)
   seconds = (dt.replace(tzinfo=None) - dt.min).seconds
   rounding = (seconds+round_to/2) // round_to * round_to
   return (dt + timedelta(0,rounding-seconds,-dt.microsecond)).replace(tzinfo=timezone.utc)

def node(node_type, parent_node=None):
    return {
        "node_id": str(uuid.uuid4()),
        "node_type": node_type, 
        "name": f"{random.choice(ADJECTIVES)}_{random.choice(ANIMALS)}",
        "parent_id": parent_node["node_id"] if parent_node else None
    }


def edge(ts, from_node_id, to_node_id):
    return {
        "ts": ts.isoformat(timespec="milliseconds"),
        "from_node_id": from_node_id,
        "to_node_id": to_node_id,
        "status": random.choices(["ok", "expected_error", "unexpected_error"], weights=(98, 1, 1), k=1)[0],
        "n": random.randint(1, 10)
    } 


def gen_data():
    all_services = [node("service") for _ in range(NUM_SERVICES)]
    all_transactions = []
    for service_node in all_services:
        all_transactions.extend([node("transaction", service_node) for _ in range(TRANSACTION_PER_SERVICE)])

    service_weights = [100 / (1.2 ** step) for step in range(1, len(all_services) + 1)] 
    transaction_weights = [100 / (1.2 ** step) for step in range(1, len(all_transactions) + 1)] 

    while True:
        edges = []
        ts = round_time(datetime.now(timezone.utc))
        all_nodes = {}
        for _ in range(EDGES_PER_PERIOD):
            from_node, to_node = [None, None]  
            # hacky weighted sampling lol
            while from_node == to_node:
                from_node, to_node = random.choices(all_services, weights=service_weights, k=2)
            edges.append(edge(ts, from_node["node_id"], to_node["node_id"]))
            for n in (from_node, to_node):
                all_nodes[n["node_id"]] = n
        payload = {
            "project_id": PROJECT_ID, 
            "nodes": list(all_nodes.values()), 
            "edges": edges
        }
        print("SUBMIT")
        print(json.dumps(payload, indent=2))
        requests.post("http://localhost:8000/submit", json=payload)
        time_to_sleep = ((ts + timedelta(seconds=FLUSH_INTERVAL_SECONDS)) - datetime.now(timezone.utc)).total_seconds()
        if time_to_sleep > 0:
            print("SLEEPING FOR", time_to_sleep)
            time.sleep(time_to_sleep)



if __name__ == "__main__":
    gen_data()
