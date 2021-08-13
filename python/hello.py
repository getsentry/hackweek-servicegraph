import servicegraph_sdk
import requests
from flask import Flask


servicegraph_sdk.init()


app = Flask(__name__)


@app.route("/ip")
def whats_my_ip():
    return requests.get("https://icanhazip.com/").text


@app.route("/broken")
def broken():
    return requests.post("https://httpbin.org/status/500").text
