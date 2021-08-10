"""
Test servicegraph server, just accepts requests on the /identity endpoint and dumps them to the console (basically an echo server).
"""
import logging
from flask import Flask, request
import pprint

_log = logging.getLogger("main")

app = Flask(__name__)
pp = pprint.PrettyPrinter(indent=4)


@app.route("/identity/", methods=['POST', 'PUT'])
def identity():
    pretty_print_request()
    return "", 201


@app.route("/submit/", methods=['POST', 'PUT'])
def submit():
    pretty_print_request()
    return "", 201


def pretty_print_request():
    data = request.json
    result = pp.pformat(data)
    _log.debug(result)


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
