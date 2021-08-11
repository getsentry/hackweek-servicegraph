import minimal
import uuid
import requests
import logging
import random

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
    ret_val = f"http://localhost:{APP_PORT}"

    if relative[0] != "/":
        ret_val += "/"

    ret_val += relative

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
            resp = requests.post(to_url("payment/"), json=req)
            return from_response(resp)
        else:
            return f"Invalid request type", 400

    return app


def create_shop():
    app = Flask("shop")
    app.debug = True

    @app.route('/', methods=["POST", "PUT"])
    def shop():
        _log.debug("in shop")
        return 'Hello Shop!'

    return app


def create_payment():
    app = Flask("payment")
    app.debug = True

    @app.route('/', methods=["POST", "PUT"])
    def payment():
        _log.debug("in payment")

        try:
            req = request.json
        except:
            _log.debug("create authentication bad request")
            return "invalid request", 400

        payment_provider = str(req.get("payment_provider")).lower()

        providers = [x.lower() for x in payment_providers()]

        if payment_provider not in providers:
            _log.debug(f"invalid payment provider {payment_provider}")
            return "invalid authenticator provider", 400

        pay_url = to_url(f"pay/{payment_provider}")

        resp = requests.post(pay_url, req)
        return from_response(resp)



    return app


def create_authentication():
    app = Flask("authentication")
    app.debug = True

    @app.route('/', methods=["POST", "PUT"])
    def authentication():
        _log.debug("in auth")

        try:
            req = request.json
        except:
            _log.debug("create authentication bad request")
            return "invalid request", 400

        auth_provider = str(req.get("auth_provider")).lower()

        auth_providers = [x.lower() for x in authentication_providers()]

        if auth_provider not in auth_providers:
            _log.debug(f"invalid auth provider {auth_provider}")
            return "invalid authenticator provider", 400

        auth_url = to_url(f"authenticate/{auth_provider}")

        resp = requests.post(auth_url, req)
        return from_response(resp)

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


def create_payment_provider(name):
    app = Flask(name)
    app.debug = True

    @app.route('/', methods=["POST", "PUT"])
    def pay():
        _log.debug(f"in payment provider {name}")
        payment_status = random.random()

        if payment_status < 0.8:
            return "Success", 200
        elif payment_status < 0.95:
            return "Payment Declined", 404
        else:
            return "Provider is experiencing some difficulties", 500

    return app


def create_auth_provider(name):
    app = Flask(name)
    app.debug = True

    @app.route('/', methods=["POST", "PUT"])
    def authenticate():
        _log.debug(f"in payment provider {name}")
        payment_status = random.random()

        if payment_status < 0.8:
            return "Success", 200
        elif payment_status < 0.95:
            return "Bad Credentials", 401
        else:
            return "Provider is experiencing some difficulties", 500

    return app


def payment_providers():
    return ["PayPal", "Due", "Stripe", "FlagShip", "Square", "BitPay", "Adyen", "GoCardless", "Visa"]


def add_payment_providers(apps):
    providers = payment_providers()
    for provider in providers:
        apps[f"/pay/{provider.lower()}"] = create_payment_provider(provider)

    return apps


def authentication_providers():
    return ["Google", "Facebook", "Twitter", "Yahoo", "Apple", "Microsoft", "Github"]


def add_authentication_providers(apps):
    auth_providers = authentication_providers()

    for provider in auth_providers:
        apps[f"/authenticate/{provider.lower()}"] = create_auth_provider(provider)

    return apps


if __name__ == '__main__':
    apps = {
        "/shop": create_shop(),
        "/payment": create_payment(),
        "/auth": create_authentication(),
    }
    add_payment_providers(apps)
    add_authentication_providers(apps)

    app = DispatcherMiddleware(create_main(), apps)
    run_simple('localhost', APP_PORT, app,
               use_reloader=True, use_debugger=False, use_evalex=True, threaded=True)
