"""
mcp_server.py
-------------
The MCP server YOUR product exposes to client agents.

A client does NOT need to know anything about Apache Superset. It calls one
of these tools with the flat JSON schema defined in mcp_tool_contract.json:

    dashboard_generate   -> builds charts + dashboard, returns a URL
    chart_data_query     -> runs one query, returns raw rows
    datasets_list        -> lists datasets/columns/metrics for discovery

Behind each tool, this server uses superset_client.py to talk to Apache
Superset and does the real work, then returns a clean JSON result.

Conventions borrowed from the superset.sh MCP docs:
  - snake_case tool names
  - Bearer token auth: OAuth 2.1 for interactive, or an API key
    ("Authorization: Bearer sk_live_...") for headless/CI clients
  - JSON in / JSON out

Transport: streamable HTTP (so remote agents can reach it like
https://your-host/mcp), matching how superset.sh exposes its v2 server.

Run:
    pip install "mcp[cli]" requests
    export SUPERSET_URL=https://your-apache-superset-host
    export SUPERSET_USER=admin
    export SUPERSET_PASSWORD=admin
    python mcp_server.py            # serves MCP over HTTP on :8000/mcp
"""

from __future__ import annotations
import os
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP

from superset_client import SupersetClient
from chart_templates import CHART_TYPES, build_query_context


# ---------------------------------------------------------------------------
# Server instance
# ---------------------------------------------------------------------------
mcp = FastMCP("dashboard-mcp")

_client: Optional[SupersetClient] = None


def superset() -> SupersetClient:
    """Lazy singleton so the server boots even before Superset is reachable."""
    global _client
    if _client is None:
        _client = SupersetClient(
            base_url=os.environ["SUPERSET_URL"],
            username=os.environ["SUPERSET_USER"],
            password=os.environ["SUPERSET_PASSWORD"],
            verify_ssl=os.environ.get("SUPERSET_VERIFY_SSL", "true") != "false",
        )
    return _client


# ---------------------------------------------------------------------------
# Mapping: client ChartSpec (contract names)  ->  internal spec (chart_templates)
# ---------------------------------------------------------------------------
def _to_internal_spec(chart: Dict[str, Any],
                      default_dataset: Any) -> Dict[str, Any]:
    """
    The public contract uses friendly names (type, dataset, time_column,
    filters[].column/value). chart_templates expects (viz_type, dataset_id,
    time_col, filters[].col/val). Translate here so the public API stays clean.
    """
    dataset = chart.get("dataset", default_dataset)
    dataset_id = _resolve_dataset_id(dataset)

    filters = []
    for f in chart.get("filters", []) or []:
        entry = {"col": f["column"], "op": f["op"]}
        if "value" in f:
            entry["val"] = f["value"]
        filters.append(entry)

    spec: Dict[str, Any] = {
        "name": chart["name"],
        "viz_type": chart["type"],
        "dataset_id": dataset_id,
        "metrics": chart.get("metrics", []),
        "dimensions": chart.get("dimensions", []),
        "time_col": chart.get("time_column"),
        "time_range": chart.get("time_range", "No filter"),
        "time_grain": chart.get("time_grain", "P1D"),
        "filters": filters,
        "row_limit": chart.get("row_limit", 10000),
    }

    # fold per-type options (subheader, bins, min_val/max_val, rows, etc.)
    opts = chart.get("options", {}) or {}
    # known option keys map straight through to the spec
    for k in ("subheader", "bins", "min_val", "max_val", "rows",
              "pivot_columns", "aggregate", "query_mode", "columns",
              "country_fieldtype", "color_scheme"):
        if k in opts:
            spec[k] = opts[k]
    # anything else becomes a raw params override
    leftover = {k: v for k, v in opts.items()
                if k not in spec and k not in (
                    "subheader", "bins", "min_val", "max_val", "rows",
                    "pivot_columns", "aggregate", "query_mode", "columns",
                    "country_fieldtype", "color_scheme")}
    if leftover:
        spec["extra"] = leftover
    return spec


def _resolve_dataset_id(dataset: Any) -> int:
    """Accept an int id directly, or resolve a dataset name to its id."""
    if isinstance(dataset, int):
        return dataset
    if isinstance(dataset, str) and dataset.isdigit():
        return int(dataset)
    if isinstance(dataset, str):
        match = superset().find_dataset_by_name(dataset)
        if match is None:
            raise ValueError(f"No dataset found matching name '{dataset}'.")
        return match["id"]
    raise ValueError("dataset must be an integer id or a dataset name string.")


# ---------------------------------------------------------------------------
# TOOL 1: dashboard_generate
# ---------------------------------------------------------------------------
@mcp.tool()
def dashboard_generate(
    title: str,
    charts: List[Dict[str, Any]],
    dataset: Optional[Any] = None,
    layout_columns: int = 2,
    embed: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate a dashboard from chart specs and return a shareable URL.

    Args:
        title: Dashboard title shown to the end user.
        charts: List of ChartSpec objects (see mcp_tool_contract.json).
        dataset: Default dataset id or name for charts that don't override it.
        layout_columns: Charts per row (1-4).
        embed: Optional {allowed_domains: [...], row_level_security: [...]}.

    Returns:
        DashboardResult with dashboard_url (send this to the user),
        standalone_url, charts, and embed credentials if requested.
    """
    internal_specs = [_to_internal_spec(c, dataset) for c in charts]

    embed_domains = None
    rls = None
    if embed:
        embed_domains = embed.get("allowed_domains")
        rls = embed.get("row_level_security")

    result = superset().generate_dashboard(
        title=title,
        chart_specs=internal_specs,
        cols_per_row=layout_columns,
        embed_domains=embed_domains,
        rls=rls,
    )
    return result


# ---------------------------------------------------------------------------
# TOOL 2: chart_data_query
# ---------------------------------------------------------------------------
@mcp.tool()
def chart_data_query(chart: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run one chart's query and return raw rows without building a dashboard.
    Use when the client wants to render the data itself.

    Args:
        chart: A single ChartSpec.

    Returns:
        {columns, rows, rowcount, query}
    """
    spec = _to_internal_spec(chart, chart.get("dataset"))
    raw = superset().get_chart_data(spec)
    block = raw["result"][0]
    return {
        "columns": block.get("colnames", []),
        "rows": block.get("data", []),
        "rowcount": block.get("rowcount", len(block.get("data", []))),
        "query": block.get("query", ""),
    }


# ---------------------------------------------------------------------------
# TOOL 3: chart_embed_links
# ---------------------------------------------------------------------------
@mcp.tool()
def chart_embed_links(
    charts: List[Dict[str, Any]],
    dataset: Optional[Any] = None,
    proxy_base: str = "http://192.168.29.41:3000",
    width: int = 600,
    height: int = 400,
) -> Dict[str, Any]:
    """
    Create charts and return per-chart embed URLs + ready-to-paste iframe HTML.
    No login needed — links go through the proxy.

    Args:
        charts: List of ChartSpec objects.
        dataset: Default dataset id or name for charts that don't specify one.
        proxy_base: Base URL of the proxy (default: WiFi address on port 3000).
        width: iframe width in pixels (default 600).
        height: iframe height in pixels (default 400).

    Returns:
        {charts: [{name, chart_id, embed_url, iframe_html}]}
    """
    internal_specs = [_to_internal_spec(c, dataset) for c in charts]
    results = superset().create_chart_embed_links(internal_specs, proxy_base, width, height)
    return {"charts": results}


# ---------------------------------------------------------------------------
# TOOL 4: datasets_list
# ---------------------------------------------------------------------------
@mcp.tool()
def datasets_list(search: Optional[str] = None) -> Dict[str, Any]:
    """
    List datasets available to query, with their columns and metrics so a
    client can build valid ChartSpecs.

    Args:
        search: Optional free-text filter on dataset name.

    Returns:
        {datasets: [{id, name, columns, metrics, time_columns}]}
    """
    return {"datasets": superset().list_datasets(search)}


if __name__ == "__main__":
    # Streamable HTTP transport -> reachable at http://0.0.0.0:8000/mcp
    mcp.run(transport="streamable-http")
