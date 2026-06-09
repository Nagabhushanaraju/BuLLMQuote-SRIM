"""
superset_client.py
------------------
Thin REST client + dashboard assembler for Apache Superset.

Flow it implements (your product's end goal):

    specs  ->  create charts  ->  build dashboard layout
           ->  create dashboard  ->  (optional) embed + guest token
           ->  return a shareable URL

Depends only on `requests` and chart_templates.py.
"""

from __future__ import annotations
import json
import re
import uuid
from typing import Any, Dict, List, Optional

import requests

from chart_templates import build_chart_payload


class SupersetClient:
    def __init__(self, base_url: str, username: str, password: str,
                 provider: str = "db", verify_ssl: bool = True):
        self.base = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.verify = verify_ssl
        self._access_token: Optional[str] = None
        self._csrf_token: Optional[str] = None
        self._login(username, password, provider)

    # ----- auth ------------------------------------------------------------
    def _login(self, username, password, provider):
        # Form-based login — more reliable than JWT in local deployments
        r = self.session.get(f"{self.base}/login/")
        r.raise_for_status()
        m = re.search(r'name="csrf_token"[^>]+value="([^"]+)"', r.text)
        if not m:
            raise RuntimeError("CSRF token not found on Superset login page")
        csrf = m.group(1)
        login = self.session.post(f"{self.base}/login/", data={
            "username": username,
            "password": password,
            "csrf_token": csrf,
        }, allow_redirects=True)
        login.raise_for_status()
        if "/login" in login.url:
            raise RuntimeError("Superset login failed — still on login page")
        # Get API CSRF token for write operations
        cr = self.session.get(f"{self.base}/api/v1/security/csrf_token/")
        cr.raise_for_status()
        self._csrf_token = cr.json()["result"]
        self.session.headers.update({
            "X-CSRFToken": self._csrf_token,
            "Referer": self.base,
            "Content-Type": "application/json",
        })

    # ----- generic ---------------------------------------------------------
    def _post(self, path, body) -> Dict[str, Any]:
        r = self.session.post(f"{self.base}{path}", data=json.dumps(body))
        if not r.ok:
            raise RuntimeError(f"POST {path} failed [{r.status_code}]: {r.text}")
        return r.json()

    def _put(self, path, body) -> Dict[str, Any]:
        r = self.session.put(f"{self.base}{path}", data=json.dumps(body))
        if not r.ok:
            raise RuntimeError(f"PUT {path} failed [{r.status_code}]: {r.text}")
        return r.json()

    def _get(self, path) -> Dict[str, Any]:
        r = self.session.get(f"{self.base}{path}")
        if not r.ok:
            raise RuntimeError(f"GET {path} failed [{r.status_code}]: {r.text}")
        return r.json()

    # ----- datasets (discovery) -------------------------------------------
    def list_datasets(self, search: Optional[str] = None) -> List[Dict[str, Any]]:
        """List datasets with their columns and metrics (for client discovery)."""
        resp = self._get("/api/v1/dataset/?q=(page_size:200)")
        out = []
        for d in resp.get("result", []):
            name = d.get("table_name", "")
            if search and search.lower() not in name.lower():
                continue
            detail = self._get(f"/api/v1/dataset/{d['id']}").get("result", {})
            cols = detail.get("columns", [])
            out.append({
                "id": d["id"],
                "name": name,
                "columns": [c["column_name"] for c in cols],
                "metrics": [m["metric_name"] for m in detail.get("metrics", [])],
                "time_columns": [c["column_name"] for c in cols
                                 if c.get("is_dttm")],
            })
        return out

    def find_dataset_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        for d in self.list_datasets(search=name):
            if d["name"].lower() == name.lower():
                return d
        matches = self.list_datasets(search=name)
        return matches[0] if matches else None

    # ----- charts ----------------------------------------------------------
    def create_chart(self, spec: Dict[str, Any]) -> Dict[str, Any]:
        """spec is a flat ChartSpec (see chart_templates docstring)."""
        payload = build_chart_payload(spec)
        resp = self._post("/api/v1/chart/", payload)
        chart_id = resp["id"]
        return {"id": chart_id, "uuid": str(uuid.uuid4()), "name": spec["name"]}

    def create_chart_embed_links(
        self,
        chart_specs: List[Dict[str, Any]],
        proxy_base: str = "http://192.168.29.41:3000",
        width: int = 600,
        height: int = 400,
    ) -> List[Dict[str, Any]]:
        """Create charts and return per-chart embed URLs + ready-to-use iframe HTML."""
        results = []
        for spec in chart_specs:
            ch = self.create_chart(spec)
            src = f"{proxy_base}/explore/?slice_id={ch['id']}&standalone=1&height={height}"
            iframe_html = (
                f'<iframe\n'
                f'  width="{width}"\n'
                f'  height="{height}"\n'
                f'  seamless\n'
                f'  frameBorder="0"\n'
                f'  scrolling="no"\n'
                f'  src="{src}"\n'
                f'>\n</iframe>'
            )
            results.append({
                "name": ch["name"],
                "chart_id": ch["id"],
                "embed_url": src,
                "iframe_html": iframe_html,
            })
        return results

    def get_chart_data(self, spec: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch raw rows WITHOUT persisting a chart (for self-rendering)."""
        from chart_templates import CHART_TYPES, build_query_context
        shape = CHART_TYPES[spec["viz_type"]]["shape"]
        qc = build_query_context(spec, shape)
        return self._post("/api/v1/chart/data", qc)

    # ----- dashboard layout ------------------------------------------------
    @staticmethod
    def _build_layout(charts: List[Dict[str, Any]], cols_per_row: int = 2
                      ) -> Dict[str, Any]:
        """
        Auto-arrange charts into rows. Superset grid width is 12 units,
        so each chart width = 12 / cols_per_row.
        """
        width = max(1, 12 // cols_per_row)
        position: Dict[str, Any] = {
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
            "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": []},
        }
        row_idx = 0
        for i, ch in enumerate(charts):
            if i % cols_per_row == 0:
                row_idx += 1
                row_id = f"ROW-{row_idx}"
                position[row_id] = {
                    "type": "ROW", "id": row_id, "children": [],
                    "meta": {"background": "BACKGROUND_TRANSPARENT"},
                }
                position["GRID_ID"]["children"].append(row_id)
            else:
                row_id = f"ROW-{row_idx}"

            chart_node = f"CHART-{ch['id']}"
            position[chart_node] = {
                "type": "CHART", "id": chart_node, "children": [],
                "meta": {
                    "chartId": ch["id"],
                    "uuid": ch["uuid"],
                    "width": width,
                    "height": 50,
                    "sliceName": ch["name"],
                },
            }
            position[row_id]["children"].append(chart_node)
        return position

    @staticmethod
    def _build_metadata(native_filters: Optional[List[Dict[str, Any]]] = None
                        ) -> Dict[str, Any]:
        return {
            "color_scheme": "supersetColors",
            "refresh_frequency": 0,
            "expanded_slices": {},
            "default_filters": "{}",
            "filter_scopes": {},
            "chart_configuration": {},
            "global_chart_configuration": {
                "scope": {"rootPath": ["ROOT_ID"], "excluded": []}
            },
            "native_filter_configuration": native_filters or [],
        }

    def create_dashboard(self, title: str, charts: List[Dict[str, Any]],
                         cols_per_row: int = 2, published: bool = True,
                         native_filters: Optional[List[Dict[str, Any]]] = None
                         ) -> Dict[str, Any]:
        position = self._build_layout(charts, cols_per_row)
        metadata = self._build_metadata(native_filters)
        slug = title.lower().replace(" ", "-")[:60]
        body = {
            "dashboard_title": title,
            "slug": f"{slug}-{uuid.uuid4().hex[:6]}",
            "published": published,
            "css": "",
            "json_metadata": json.dumps(metadata),
            "position_json": json.dumps(position),
        }
        resp = self._post("/api/v1/dashboard/", body)
        dash_id = resp["id"]
        return {
            "id": dash_id,
            "url": f"{self.base}/superset/dashboard/{dash_id}/",
            "standalone_url": f"{self.base}/superset/dashboard/{dash_id}/?standalone=1",
        }

    # ----- embedding -------------------------------------------------------
    def enable_embedding(self, dashboard_id: int,
                         allowed_domains: List[str]) -> str:
        resp = self._post(f"/api/v1/dashboard/{dashboard_id}/embedded",
                          {"allowed_domains": allowed_domains})
        return resp["result"]["uuid"]

    def guest_token(self, embed_uuid: str,
                    rls: Optional[List[Dict[str, str]]] = None,
                    username: str = "guest") -> str:
        body = {
            "user": {"username": username, "first_name": "Guest",
                     "last_name": "User"},
            "resources": [{"type": "dashboard", "id": embed_uuid}],
            "rls": rls or [],
        }
        resp = self._post("/api/v1/security/guest_token/", body)
        return resp["token"]

    # ----- one-shot orchestration -----------------------------------------
    def generate_dashboard(self, title: str, chart_specs: List[Dict[str, Any]],
                           cols_per_row: int = 2,
                           embed_domains: Optional[List[str]] = None,
                           rls: Optional[List[Dict[str, str]]] = None
                           ) -> Dict[str, Any]:
        """
        Full pipeline: create all charts -> dashboard -> (optional) embed.
        Returns dict with dashboard id, urls, and embed credentials.
        """
        created = [self.create_chart(s) for s in chart_specs]
        dash = self.create_dashboard(title, created, cols_per_row)

        result = {
            "dashboard_id": dash["id"],
            "dashboard_url": dash["url"],
            "standalone_url": dash["standalone_url"],
            "charts": created,
        }

        if embed_domains:
            embed_uuid = self.enable_embedding(dash["id"], embed_domains)
            token = self.guest_token(embed_uuid, rls)
            result["embed_uuid"] = embed_uuid
            result["guest_token"] = token

        return result
