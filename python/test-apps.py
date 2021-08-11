import minimal
import uuid
import requests
import logging

from flask import Flask, request
from werkzeug.serving import run_simple
from werkzeug.middleware.dispatcher import DispatcherMiddleware

_log = logging.getLogger("main")
REPORTING_PORT = 5000
APP_PORT = 8000
SERVICE_NS = uuid.UUID('13f07817-8ccb-4961-8507-1a3e6fd02066')
minimal.init(port=REPORTING_PORT, service_ns=SERVICE_NS, project_id=1)


def from_response(response):
    """Convert a requests response to a flask response"""
    return response.text, response.status_code


def to_url(relative):
    ret_val = f"http://localhost:{APP_PORT}/{relative}"

    if not ret_val.endswith("/"):
        ret_val += "/"
    return ret_val


def create_main():
    app = Flask("main")

    @app.route("/", methods=["POST", "PUT"])
    def index():
        _log.debug("in main")
        try:
            req = request.json
        except:
            return "invalid request", 400

        if not req.get('auth'):
            # we are not authenticated authenticate
            resp = requests.post(to_url("auth/"), json=req)

            if not resp.ok:
                # return authentication failure
                return "failed to login", 401

        # see what they want
        request_type = req.get("type")
        if request_type == "shop":
            resp = requests.post(to_url("shop/"), json=req)
            return from_response(resp)
        elif request_type == "pay":
            resp = requests.post(to_url("pay/"), json=req)
            return from_response(resp)
        else:
            return f"Invalid request type", 400

    return app


def create_shop():
    app = Flask("shop")
    app.debug = True

    @app.route('/', methods=["POST", "PUT"])
    def hello_world():
        _log.debug("in shop")
        return 'Hello Shop!'

    return app


def create_payment():
    app = Flask("payment")
    app.debug = True

    @app.route('/', methods=["POST", "PUT"])
    def hello_world():
        _log.debug("in payment")
        return 'Hello Payment!'

    return app


def create_authentication():
    app = Flask("authentication")
    app.debug = True

    @app.route('/', methods=["POST", "PUT"])
    def hello_world():
        _log.debug("in auth")
        return 'Hello Authentication!'

    return app


def _configure_logging():
    """
    Configures the logger of the app
    """
    # todo make it configurable
    _log.setLevel(logging.DEBUG)

    # create console handler and set level to debug
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)

    # create formatter
    formatter = logging.Formatter('\n %(asctime)s: \n %(message)s')

    # add formatter to ch
    ch.setFormatter(formatter)

    # add ch to logger
    _log.addHandler(ch)


_configure_logging()


if __name__ == '__main__':
    app = DispatcherMiddleware(create_main(), {
        "/shop": create_shop(),
        "/payment": create_payment(),
        "/auth": create_authentication(),
    })
    run_simple('localhost', APP_PORT, app,
               use_reloader=True, use_debugger=False, use_evalex=True, threaded=True)

