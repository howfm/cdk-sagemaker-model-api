import logging
import shlex
import subprocess
import sys
from subprocess import CalledProcessError
from timeit import default_timer as timer

from flask import Flask, Response, request
from retrying import retry
from waitress import serve

from src.inference.handler_service import ModelHandler

handler = ModelHandler()

app = Flask(__name__)
# TODO: Can the lambda logger be used inside sagemaker? :thinking:
logging.basicConfig(level=logging.DEBUG)


def _retry_if_error(exception):
    return isinstance(exception, CalledProcessError)


@app.route("/invocations", methods=["POST"])
def invoke():
    body = request.get_json(force=True)
    app.logger.info(f"body: {body}")
    start = timer()
    output = handler.handle(body)
    elapsed_time = timer() - start
    app.logger.info(f"model execution took {elapsed_time:0.2f} seconds")
    app.logger.info(f"output: {output}")
    return output


@app.route("/ping", methods=["GET"])
def ping():
    status = 200 if handler.initialized else 404
    return Response(response="ping!", status=status, mimetype="application/json")


@retry(stop_max_delay=1000 * 30, retry_on_exception=_retry_if_error)
def _start_serve():
    if not handler.initialized:
        handler.initialize()
    serve(app, host="0.0.0.0", port=8080)


def main():
    if sys.argv[1] == "serve":
        _start_serve()
    else:
        subprocess.check_call(shlex.split(" ".join(sys.argv[1:])))

    # prevent docker exit
    subprocess.call(["tail", "-f", "/dev/null"])


main()
