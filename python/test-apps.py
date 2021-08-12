import minimal
import uuid
import requests
import logging
import random

from flask import Flask, request
from werkzeug.serving import run_simple
from werkzeug.middleware.dispatcher import DispatcherMiddleware

from provider_names import departments, payment_providers, authentication_providers

_log = logging.getLogger("main")
REPORTING_PORT = 8000
APP_PORT = 5000
SERVICE_NS = uuid.UUID('13f07817-8ccb-4961-8507-1a3e6fd02066')
minimal.init(port=REPORTING_PORT, service_ns=SERVICE_NS, project_id=1)


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
    run_simple('localhost', APP_PORT, app,
               use_reloader=True, use_debugger=False, use_evalex=True, threaded=True)


def create_main_service():
    app = Flask("Welcome")

    @app.route("/", methods=["POST", "PUT"], endpoint="welcome-main")
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
        return ""

    @app.route("/browse", methods=["POST", "PUT"], endpoint="welcome-browse")
    def browse():
        resp = requests.post(to_url("shop/"), json=request.json)
        return from_response(resp)

    @app.route("/cart", methods=["POST", "PUT"], endpoint="welcome-shopping-cart")
    def browse():
        resp = requests.post(to_url("pay/"), json=request.json)
        return from_response(resp)

    return app


def create_shop_service():
    app = Flask("shop")
    app.debug = True

    @app.route('/', methods=["POST", "PUT"], endpoint="shop-main")
    def shop():
        _log.debug("in shop")

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

    @app.route('/', methods=["POST", "PUT"], endpoint="payment-main")
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

    @app.route('/', methods=["POST", "PUT"], endpoint="auth-main")
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

    @app.route('/check', methods=["POST", "PUT"], endpoint="pay-check-account")
    def check_account():
        _log.debug("in check account")
        return "checked"

    @app.route("/validate", methods=["POST", "PUT"], endpoint="pay-validate")
    def validate():
        _log.debug("in validate")
        payment_status = random.random()

        if payment_status < 0.8:
            return "Success", 200
        elif payment_status < 0.95:
            return "Payment Declined", 404
        else:
            return "Provider is experiencing some difficulties", 500

    @app.route("/transfer", methods=["POST", "PUT"], endpoint="pay-transfer")
    def transfer():
        _log.debug("in check transfer")
        return "ok"

    return app


def create_auth_provider_service(name):
    app = Flask(name)
    app.debug = True

    @app.route('/credentials', methods=["POST", "PUT"], endpoint=f"auth-{name}-credentials")
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

    @app.route('/2fa', methods=["POST", "PUT"], endpoint=f"auth-{name}-2fa")
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


def create_warehouse_service(name):
    app = Flask(name)
    app.debug = True

    @app.route('/', methods=["POST", "PUT"], endpoint=f"dep-{name}-main")
    def check_product():
        _log.debug(f"in warehouse {name}")
        payment_status = random.random()

        if payment_status < 0.8:
            return "Success", 200
        elif payment_status < 0.95:
            return "Not Available", 401
        else:
            return "Warehouse down", 500

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


if __name__ == '__main__':
    main()
