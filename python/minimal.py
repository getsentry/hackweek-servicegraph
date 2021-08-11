import uuid
import time
import json
import threading
import atexit

from datetime import datetime
from contextvars import ContextVar
from urllib.request import urlopen, Request

SERVICE_NS = uuid.UUID("50e1147a-2643-4b97-a0bd-be87f84851c3")


def init(host=None, port=None, project_id=None, service_ns=None):
    if host is not None:
        client.host = host
    if port is not None:
        client.port = port
    if project_id is not None:
        client.project_id = project_id
    if service_ns is not None:
        client.service_ns = service_ns


class Client(object):
    def __init__(self):
        self.project_id = 1
        self.host = "localhost"
        self.port = 8000
        self.service_ns = SERVICE_NS
        self.pending_connections = {}
        self.pending_nodes = {}
        self.known_nodes = {}
        self._lock = threading.Lock()

        self._service_id = ContextVar("service_id")
        self._transaction_id = ContextVar("transaction_id")

        thread = threading.Thread(target=self._flush_loop)
        thread.daemon = True
        thread.start()

    def report_self(self, service_name, transaction_name=None):
        service_id = self.report_node(name=service_name, type="service")
        self._service_id.set(service_id)
        if transaction_name is not None:
            transaction_id = self.report_node(
                name=transaction_name, type="transaction", parent_id=service_id
            )
            self._transaction_id.set(transaction_id)

    def clear_self(self):
        self._service_id.set(None)
        self._transaction_id.set(None)

    def flush(self):
        with self._lock:
            self._flush_unlocked()

    def _flush_loop(self):
        while True:
            time.sleep(30)
            self.flush()

    def get_self_nodes(self):
        service_id = self._service_id.get()
        endpoint_id = self._endpoint_id.get()
        return service_id, endpoint_id

    def get_graph_context_header(self):
        service_id = self._service_id.get()
        if service_id is None:
            return None

        rv = "service-node=%s" % service_id

        transaction_id = self._transaction_id.get()
        if transaction_id is not None:
            rv = "%s transaction-node=%s" % (rv, transaction_id)

        return rv

    def iter_from_nodes(self):
        service_id = self._service_id.get()
        if service_id is not None:
            yield service_id
            transaction_id = self._transaction_id.get()
            if transaction_id is not None:
                yield transaction_id

    def _flush_unlocked(self):
        nodes = []
        edges = []

        for node_id, node_info in self.pending_nodes.items():
            node_info["node_id"] = node_id
            nodes.append(node_info)

        for bucket, counters in self.pending_connections.items():
            print(f"bucket {bucket} type={type(bucket)}")
            print(f"counters {counters} type={type(counters)}")
            from_node, to_node, ts = bucket
            for status, n in counters.items():
                edges.append(
                    {
                        "ts": datetime.utcfromtimestamp(ts).isoformat() + "Z",
                        "from_node_id": from_node,
                        "to_node_id": to_node,
                        "status": status,
                        "n": n,
                    }
                )

        urlopen(
            Request(
                url="http://%s:%d/submit/" % (self.host, self.port),
                headers={"content-type": "application/json"},
                method="POST",
                data=bytes(json.dumps(
                    {"nodes": nodes, "edges": edges, "project_id": self.project_id}
                ), 'utf-8'),
            )
        )

        self.pending_connections = {}
        self.pending_nodes = {}

    def report_node(self, name, type="service", parent_id=None):
        if type == "service":
            namespace = self.service_ns
        elif type == "transaction":
            namespace = parent_id
        else:
            raise TypeError("unknown type")

        seen_key = (name, type)
        node_id = self.known_nodes.get(seen_key)
        if node_id is not None:
            return node_id

        guid = uuid.uuid5(namespace, name)
        self.pending_nodes[str(guid)] = {
            "name": name,
            "node_type": type,
            "parent_id": str(parent_id) if parent_id is not None else None,
        }
        self.known_nodes[seen_key] = guid
        return guid

    def report_edge(self, from_node, to_node, status="ok", n=1):
        t = time.time() // 60 * 60
        bucket = (str(from_node), str(to_node), t)

        with self._lock:
            counters = self.pending_connections.setdefault(bucket, {})
            counters[status] = counters.get(status, 0) + n


client = Client()


def parse_graph_context_header(header):
    """
    Parses the node information from a header

    Uses the format "key=value key=value"

    >>> parse_graph_context_header("service-node=50e1147a-2643-4b97-a0bd-be87f84851c3")
    {'service-node': UUID('50e1147a-2643-4b97-a0bd-be87f84851c3')}
    >>> parse_graph_context_header("service-node=50e1147a26434b97a0bdbe87f84851c3")
    {'service-node': UUID('50e1147a-2643-4b97-a0bd-be87f84851c3')}
    >>> parse_graph_context_header("transaction-node=50e1147a26434b97a0bdbe87f84851c3")
    {'transaction-node': UUID('50e1147a-2643-4b97-a0bd-be87f84851c3')}
    >>> result = parse_graph_context_header("transaction-node=50e1147a26434b97a0bdbe87f84851c3 service-node=c221a8bef9be11eb9a030242ac130003")
    >>> len(result)
    2
    >>> result['transaction-node']
    UUID('50e1147a-2643-4b97-a0bd-be87f84851c3')
    >>> result['service-node']
    UUID('c221a8be-f9be-11eb-9a03-0242ac130003')
    """
    rv = {}

    for piece in header.split():
        items = piece.split("=", 1)
        if len(items) != 2:
            continue
        key, value = items
        if key in ("service-node", "transaction-node"):
            try:
                rv[key] = uuid.UUID(value)
            except ValueError:
                pass

    return rv


def _patch_httplib():
    from http.client import HTTPConnection

    real_putrequest = HTTPConnection.putrequest
    real_getresponse = HTTPConnection.getresponse

    def putrequest(self, method, url, *args, **kwargs):
        host = self.host
        port = self.port
        default_port = self.default_port

        real_url = url
        if not real_url.startswith(("http://", "https://")):
            real_url = "%s://%s%s%s" % (
                default_port == 443 and "https" or "http",
                host,
                port != default_port and ":%s" % port or "",
                url,
            )

        rv = real_putrequest(self, method, url, *args, **kwargs)
        self._servicegraph_info = real_url

        return rv

    def getresponse(self, *args, **kwargs):
        info = getattr(self, "_servicegraph_info", None)

        if info is None:
            return real_getresponse(self, *args, **kwargs)

        rv = real_getresponse(self, *args, **kwargs)

        graph_context = parse_graph_context_header(
            rv.headers.get("servicegraph-context") or ""
        )
        if not graph_context:
            return rv

        if rv.status >= 400 and rv.status < 500:
            status = "expected_error"
        elif rv.status >= 500:
            status = "unexpected_error"
        else:
            status = "ok"

        for to_node in graph_context.values():
            for from_node in client.iter_from_nodes():
                client.report_edge(
                    from_node=from_node,
                    to_node=to_node,
                    status=status,
                )

        return rv

    HTTPConnection.putrequest = putrequest
    HTTPConnection.getresponse = getresponse


def _patch_flask():
    from flask import Flask, request

    old_process_response = Flask.process_response
    old_full_dispatch_request = Flask.full_dispatch_request

    def patched_full_dispatch_request(self):
        client.report_self(
            service_name=self.import_name,
            transaction_name=request.endpoint,
        )
        return old_full_dispatch_request(self)

    def patched_process_response(self, response):
        response = old_process_response(self, response)
        response.headers["servicegraph-context"] = client.get_graph_context_header()
        client.clear_self()
        return response

    Flask.process_response = patched_process_response
    Flask.full_dispatch_request = patched_full_dispatch_request


def _register_atexit():
    atexit.register(client.flush)


_patch_httplib()
_patch_flask()
_register_atexit()
