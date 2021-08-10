import minimal
import uuid
import requests

SERVICE_NS = uuid.UUID('13f07817-8ccb-4961-8507-1a3e6fd02066')
minimal.init(port=5000,service_ns=SERVICE_NS, project_id=1)

from flask import Flask
from werkzeug.serving import run_simple

app = Flask(__name__)
app.debug = True


@app.route('/', methods=["POST", "PUT"])
def hello_world():
    return 'Hello World!'

if __name__ == '__main__':
    run_simple('localhost', 8000, app,
               use_reloader=True, use_debugger=False, use_evalex=True, threaded=True)
