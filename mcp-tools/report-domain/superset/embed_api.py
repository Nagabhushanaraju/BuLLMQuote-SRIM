"""
embed_api.py
------------
Minimal HTTP REST API for generating per-chart embed links.

Endpoints:
  POST /api/embed-links              — create charts from specs, return embed links
  GET  /api/embed-links/dashboard/17 — embed links for all charts in a dashboard

Run:  python embed_api.py
      (keep dashboard_proxy.js running on port 3000 for the embed URLs to work)
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from superset_client import SupersetClient

PROXY_BASE = "http://192.168.29.41:3000"
API_PORT   = 8089


def get_client():
    return SupersetClient(
        base_url=os.environ.get("SUPERSET_URL",      "http://localhost:8088"),
        username=os.environ.get("SUPERSET_USER",     "admin"),
        password=os.environ.get("SUPERSET_PASSWORD", "admin"),
        verify_ssl=False,
    )


def build_iframe(src, width, height):
    return (
        f'<iframe width="{width}" height="{height}" seamless '
        f'frameBorder="0" scrolling="no" src="{src}"></iframe>'
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  [api] {self.address_string()} — {fmt % args}")

    def send_json(self, code, body):
        data = json.dumps(body, indent=2).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ── GET /api/embed-links/dashboard/{id} ──────────────────────────────────
    def do_GET(self):
        m = re.match(r"^/api/embed-links/dashboard/(\d+)$", self.path)
        if not m:
            self.send_json(404, {"status": "error", "message": "Not found. Try GET /api/embed-links/dashboard/17"})
            return
        dash_id = int(m.group(1))
        try:
            client = get_client()
            resp   = client._get(f"/api/v1/dashboard/{dash_id}/charts")
            width, height = 600, 400
            charts = []
            for ch in resp.get("result", []):
                src = f"{PROXY_BASE}/explore/?slice_id={ch['id']}&standalone=1&height={height}"
                charts.append({
                    "name":       ch["slice_name"],
                    "chart_id":   ch["id"],
                    "embed_url":  src,
                    "iframe_html": build_iframe(src, width, height),
                })
            self.send_json(200, {"status": "success", "count": len(charts), "charts": charts})
        except Exception as e:
            self.send_json(500, {"status": "error", "message": str(e)})

    # ── POST /api/embed-links ─────────────────────────────────────────────────
    def do_POST(self):
        if self.path != "/api/embed-links":
            self.send_json(404, {"status": "error", "message": "Not found. Try POST /api/embed-links"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body   = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError as e:
            self.send_json(400, {"status": "error", "message": f"Invalid JSON: {e}"})
            return

        try:
            client  = get_client()
            width   = int(body.get("width",  600))
            height  = int(body.get("height", 400))
            dataset = body.get("dataset")

            def resolve_dataset(d):
                if isinstance(d, int):
                    return d
                if isinstance(d, str) and d.isdigit():
                    return int(d)
                ds = client.find_dataset_by_name(d)
                if not ds:
                    raise ValueError(f"Dataset '{d}' not found. Call GET /api/embed-links/dashboard/17 to list available datasets.")
                return ds["id"]

            internal_specs = []
            for c in body.get("charts", []):
                ds_id = resolve_dataset(c.get("dataset", dataset))
                internal_specs.append({
                    "name":       c["name"],
                    "viz_type":   c["type"],
                    "dataset_id": ds_id,
                    "metrics":    c.get("metrics",    []),
                    "dimensions": c.get("dimensions", []),
                    "time_col":   c.get("time_column"),
                    "time_range": c.get("time_range", "No filter"),
                    "filters":    [],
                })

            results = client.create_chart_embed_links(internal_specs, PROXY_BASE, width, height)
            self.send_json(200, {"status": "success", "count": len(results), "charts": results})
        except Exception as e:
            self.send_json(500, {"status": "error", "message": str(e)})


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", API_PORT), Handler)
    print("=" * 55)
    print("  Chart Embed Links API")
    print("=" * 55)
    print(f"  GET  http://192.168.29.41:{API_PORT}/api/embed-links/dashboard/17")
    print(f"  POST http://192.168.29.41:{API_PORT}/api/embed-links")
    print("  (keep dashboard_proxy.js on port 3000 running)")
    print("=" * 55)
    server.serve_forever()
