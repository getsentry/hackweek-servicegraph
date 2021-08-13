import servicegraph_sdk
import uuid
import requests
import logging
import random
import yaml
import pathlib

from flask import Flask, request
from werkzeug.serving import run_simple
from werkzeug.middleware.dispatcher import DispatcherMiddleware

from provider_names import departments, payment_providers, authentication_providers

_log = logging.getLogger("main")
REPORTING_PORT = 8000
APP_PORT = 5000
SERVICE_NS = uuid.UUID("13f07817-8ccb-4961-8507-1a3e6fd02066")
servicegraph_sdk.init(port=REPORTING_PORT, service_ns=SERVICE_NS, project_id=1)

_prand_seed = random.random()


def prand(value):
    return random.Random(hash((_prand_seed, value)))


def can_fail(name, cutoff):
    val = prand(name).random()
    if val < cutoff:
        return val
    return max(random.random(), cutoff)


def get_at_path(obj, path):
    """
    Get value at path
    """

    paths = path.split(".")
    ret_val = obj

    for segment in paths:
        try:
            ret_val = ret_val.get(segment, None)
            if ret_val is None:
                break
        except:
            return None
    return ret_val


def get_config():
    try:
        config_file_name =pathlib.Path(__file__).parent.joinpath("test-apps.config.yml").resolve()
        with open(config_file_name, "r") as f:
            return yaml.load(f)
    except:
        return {}


def check_endpoint_status(name):
    config = get_config()
    status = get_at_path(config, name)

    if type(status) == int:
        return status
    elif type(status) == str:
        status = status.lower()
        if status == "ok":
            return 200
        if status == "error" or status == "expected":
            return 400
        if status == "critical" or status == "unexpected":
            return 500

    # if we are here just do a random thing:
    status = can_fail(name, 0.9)

    if status < 0.9:
        return 200
    elif status < 0.95:
        return 400
    else:
        return 500


def main():
    _configure_logging()
    apps = {
        "/shop": create_shop_service(),
        "/pay": create_payment_service(),
        "/auth": create_authentication_service(),
    }
    add_payment_providers(apps)
    add_authentication_providers(apps)
    add_warehouses(apps)

    app = DispatcherMiddleware(create_main_service(), apps)
    run_simple(
        "localhost",
        APP_PORT,
        app,
        use_reloader=True,
        use_debugger=False,
        use_evalex=True,
        threaded=True,
    )


def create_main_service():
    app = Flask("welcome")

    @app.route("/", methods=["POST", "PUT"], endpoint="index")
    def index():
        status = check_endpoint_status("welcome.index")
        if status >= 400:
            return "failed", status

        _log.debug("in main")
        try:
            req = request.json
        except:
            return "invalid request", 400

        if not req.get("auth"):
            # we are not authenticated authenticate
            resp = requests.post(to_url("auth/"), json=req)

            if not resp.ok:
                # return authentication failure
                return "failed to login", 401
        return ""

    @app.route("/browse", methods=["POST", "PUT"], endpoint="browse")
    def browse():
        status = check_endpoint_status("welcome.browse")
        if status >= 400:
            return "failed", status

        resp = requests.post(to_url("shop/"), json=request.json)
        return from_response(resp)

    @app.route("/cart", methods=["POST", "PUT"], endpoint="shopping-cart")
    def browse():
        status = check_endpoint_status("welcome.cart")
        if status >= 400:
            return "failed", status

        resp = requests.post(to_url("pay/"), json=request.json)
        return from_response(resp)

    return app


def create_shop_service():
    app = Flask("shop")
    app.debug = True

    @app.route("/", methods=["POST", "PUT"], endpoint="overview")
    def shop():
        status = check_endpoint_status("shop.overview")
        if status >= 400:
            return "failed", status

        try:
            req = request.json
        except:
            _log.debug("create authentication bad request")
            return "invalid request", 400

        department = str(req.get("department")).lower()

        deps = [x.lower() for x in departments()]

        if department not in deps:
            _log.debug(f"invalid department {department}")
            return "invalid department", 400

        warehouse_url = to_url(f"shop/{department}")

        resp = requests.post(warehouse_url, req)
        return from_response(resp)

    return app


def create_payment_service():
    app = Flask("payment")
    app.debug = True

    @app.route("/", methods=["POST", "PUT"], endpoint="submit-payment")
    def payment():
        status = check_endpoint_status("payment.submit")
        if status >= 400:
            return "failed", status

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

        pay_url = to_url(f"pay/{payment_provider}/check")

        resp = requests.post(pay_url, json=req)

        if resp.ok:
            pay_url = to_url(f"pay/{payment_provider}/validate")
            resp = requests.post(pay_url, json=req)

            if resp.ok:
                pay_url = to_url(f"pay/{payment_provider}/transfer")
                resp = requests.post(pay_url, json=req)

        return from_response(resp)

    return app


def create_authentication_service():
    app = Flask("authentication")
    app.debug = True

    @app.route("/", methods=["POST", "PUT"], endpoint="authenticate")
    def authentication():
        status = check_endpoint_status("authentication.authenticate")
        if status >= 400:
            return "failed", status

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

        # first stage auth
        resp = requests.post(to_url(f"auth/{auth_provider}/credentials"), json=req)
        if resp.ok:
            # 2fa
            resp = requests.post(to_url(f"auth/{auth_provider}/2fa"), json=req)

        return from_response(resp)

    return app


def create_payment_provider_service(name):
    app = Flask(name)
    app.debug = True

    @app.route("/check", methods=["POST", "PUT"], endpoint="check-account")
    def check_account():
        _log.debug("in check account")
        status = check_endpoint_status(f"payment_provider.{name}.check")
        return "", status


    @app.route("/validate", methods=["POST", "PUT"], endpoint="validate")
    def validate():
        _log.debug("in validate account")
        status = check_endpoint_status(f"payment_provider.{name}.validate")
        return "", status

    @app.route("/transfer", methods=["POST", "PUT"], endpoint="transfer")
    def transfer():
        _log.debug("in transfer account")
        status = check_endpoint_status(f"payment_provider.{name}.transfer")
        return "", status

    return app


def create_auth_provider_service(name):
    app = Flask(name)
    app.debug = True

    @app.route(
        "/credentials", methods=["POST", "PUT"], endpoint=f"auth-{name}-credentials"
    )
    def authenticate():
        _log.debug(f"in payment provider {name}")
        status = check_endpoint_status(f"auth_provider.{name}.authenticate")
        return "", status

    @app.route("/2fa", methods=["POST", "PUT"], endpoint=f"2fa")
    def mfa():
        _log.debug(f"in payment provider {name}")
        status = check_endpoint_status(f"auth_provider.{name}.mfa")
        return "", status

    return app


def create_warehouse_service(name):
    app = Flask(name)
    app.debug = True

    @app.route("/", methods=["POST", "PUT"], endpoint=f"list-products")
    def check_product():
        _log.debug(f"in warehouse {name}")
        status = check_endpoint_status(f"warehouse.{name}.list")
        return "", status

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
    formatter = logging.Formatter("\n %(asctime)s: \n %(message)s")

    # add formatter to ch
    ch.setFormatter(formatter)

    # add ch to logger
    _log.addHandler(ch)


def add_payment_providers(apps):
    providers = payment_providers()
    for provider in providers:
        apps[f"/pay/{provider.lower()}"] = create_payment_provider_service(provider)

    return apps


def add_authentication_providers(apps):
    auth_providers = authentication_providers()

    for provider in auth_providers:
        apps[f"/auth/{provider.lower()}"] = create_auth_provider_service(provider)

    return apps


def add_warehouses(apps):
    for departament in departments():
        apps[f"/shop/{departament.lower()}"] = create_warehouse_service(departament)


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


if __name__ == "__main__":
    main()
