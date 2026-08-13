import sys
import os

# Ensure project root is on the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import create_app

app = create_app()


def _to_wsgi_environ(event, context):
    """Convert a Netlify/Lambda event into a WSGI environ dict."""
    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    query_string = event.get("rawQueryString") or ""
    if not query_string and event.get("queryStringParameters"):
        params = event.get("queryStringParameters") or {}
        query_string = "&".join(
            f"{k}={v}" for k, v in params.items() if v is not None
        )
    headers = event.get("headers") or {}
    body = event.get("body") or ""
    is_base64 = event.get("isBase64Encoded", False)

    if is_base64:
        import base64
        body = base64.b64decode(body)

    environ = {
        "REQUEST_METHOD": method,
        "PATH_INFO": path,
        "QUERY_STRING": query_string,
        "SERVER_NAME": headers.get("host", "localhost"),
        "SERVER_PORT": "443",
        "HTTP_HOST": headers.get("host", "localhost"),
        "wsgi.version": (1, 0),
        "wsgi.input": sys.stdin.buffer if hasattr(sys.stdin, "buffer") else sys.stdin,
        "wsgi.errors": sys.stderr,
        "wsgi.multithread": False,
        "wsgi.multiprocess": False,
        "wsgi.run_once": True,
        "wsgi.url_scheme": "https",
    }

    for key, value in headers.items():
        key = key.upper().replace("-", "_")
        if key == "CONTENT_TYPE":
            environ["CONTENT_TYPE"] = value
        elif key == "CONTENT_LENGTH":
            environ["CONTENT_LENGTH"] = value
        else:
            environ[f"HTTP_{key}"] = value

    if body:
        environ["wsgi.input"] = type("FakeIO", (), {"read": lambda self, n=-1: body})()

    return environ


def _format_status(status_str):
    """Convert '200 OK' to 200."""
    return int(status_str.split(" ")[0])


def handler(event, context):
    """Netlify Function entrypoint for the Flask app."""
    environ = _to_wsgi_environ(event, context)

    response_status = None
    response_headers = []
    response_body = []

    def start_response(status, headers, exc_info=None):
        nonlocal response_status, response_headers
        response_status = _format_status(status)
        response_headers = list(headers)

    result = app(environ, start_response)
    try:
        for data in result:
            if data:
                response_body.append(data)
    finally:
        if hasattr(result, "close"):
            result.close()

    body = b"".join(response_body)
    if isinstance(body, bytes):
        body = body.decode("utf-8", errors="replace")

    headers = {key: value for key, value in response_headers}

    return {
        "statusCode": response_status or 500,
        "headers": headers,
        "body": body,
        "isBase64Encoded": False,
    }
