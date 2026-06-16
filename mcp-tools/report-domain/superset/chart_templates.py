"""
chart_templates.py
-------------------
Boilerplate templates for every major Superset chart type.

USAGE MODEL
-----------
Your caller fills a small, flat dict ("ChartSpec") and passes it to
build_chart_payload(). That returns the exact JSON body for
POST /api/v1/chart/  (with `params` and `query_context` already
stringified the way Superset requires).

A ChartSpec looks like:

    {
        "name": "Sales Last 15 Days",
        "viz_type": "line",            # friendly key, see CHART_TYPES below
        "dataset_id": 5,
        "time_col": "order_date",      # time/x column
        "time_range": "Last 15 days",
        "metrics": ["total_amount"],   # list of metric names (defined on dataset)
        "dimensions": ["region"],      # group-by columns (optional)
        "filters": [                   # optional
            {"col": "region", "op": "IN", "val": ["West", "East"]}
        ],
        "row_limit": 1000,             # optional
        "extra": {}                    # optional viz-specific overrides
    }

You only ever fill the flat fields. The templates handle the rest.
"""

from __future__ import annotations
import json
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# 1. CHART TYPE REGISTRY
# ---------------------------------------------------------------------------
# Maps a friendly key -> Superset internal viz_type + which "shape" of
# params/query it needs. "single_metric" viz use `metric` (singular);
# everything else uses `metrics` (list).
# ---------------------------------------------------------------------------

CHART_TYPES: Dict[str, Dict[str, Any]] = {
    # key                 viz_type (superset)            shape
    "line":              {"viz_type": "echarts_timeseries_line",  "shape": "timeseries"},
    "bar":               {"viz_type": "echarts_timeseries_bar",   "shape": "timeseries"},
    "area":              {"viz_type": "echarts_area",             "shape": "timeseries"},
    "scatter":           {"viz_type": "echarts_timeseries_scatter","shape": "timeseries"},
    "smooth_line":       {"viz_type": "echarts_timeseries_smooth","shape": "timeseries"},
    "table":             {"viz_type": "table",                    "shape": "table"},
    "pivot_table":       {"viz_type": "pivot_table_v2",           "shape": "pivot"},
    "big_number":        {"viz_type": "big_number_total",         "shape": "single_metric"},
    "big_number_trend":  {"viz_type": "big_number",               "shape": "single_metric_ts"},
    "pie":               {"viz_type": "pie",                      "shape": "single_metric"},
    "funnel":            {"viz_type": "funnel",                   "shape": "single_metric"},
    "gauge":             {"viz_type": "gauge_chart",              "shape": "single_metric"},
    "histogram":         {"viz_type": "histogram",                "shape": "raw"},
    "box_plot":          {"viz_type": "box_plot",                 "shape": "distribution"},
    "heatmap":           {"viz_type": "heatmap",                  "shape": "heatmap"},
    "treemap":           {"viz_type": "treemap_v2",               "shape": "single_metric"},
    "sunburst":          {"viz_type": "sunburst_v2",              "shape": "single_metric"},
    "world_map":         {"viz_type": "world_map",                "shape": "geo"},
    "mixed_timeseries":  {"viz_type": "mixed_timeseries",         "shape": "timeseries"},
    "bubble":            {"viz_type": "bubble_v2",                "shape": "bubble"},
}


# ---------------------------------------------------------------------------
# 2. HELPERS
# ---------------------------------------------------------------------------

def _adhoc_filters(filters: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Convert simple {col, op, val} filters into Superset adhoc_filters."""
    out = []
    for f in filters or []:
        out.append({
            "expressionType": "SIMPLE",
            "subject": f["col"],
            "operator": f["op"],          # IN, NOT IN, ==, !=, >, <, >=, <=, LIKE, IS NOT NULL ...
            "comparator": f.get("val"),
            "clause": "WHERE",
        })
    return out


def _query_filters(filters: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Filters in the shape query_context expects."""
    out = []
    for f in filters or []:
        entry = {"col": f["col"], "op": f["op"]}
        if "val" in f:
            entry["val"] = f["val"]
        out.append(entry)
    return out


def _metric_list(spec: Dict[str, Any]) -> List[str]:
    m = spec.get("metrics") or []
    if isinstance(m, str):
        m = [m]
    return m


# ---------------------------------------------------------------------------
# 3. PARAMS BUILDERS  (one per "shape")
# ---------------------------------------------------------------------------
# Each returns the decoded params dict. build_chart_payload() stringifies it.
# ---------------------------------------------------------------------------

def _params_timeseries(spec, viz_type) -> Dict[str, Any]:
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "x_axis": spec["time_col"],
        "time_grain_sqla": spec.get("time_grain", "P1D"),
        "granularity_sqla": spec["time_col"],
        "time_range": spec.get("time_range", "No filter"),
        "metrics": _metric_list(spec),
        "groupby": spec.get("dimensions", []),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 10000),
        "color_scheme": spec.get("color_scheme", "supersetColors"),
        "show_legend": True,
        "rich_tooltip": True,
        "x_axis_title": spec.get("x_axis_title", ""),
        "y_axis_title": spec.get("y_axis_title", ""),
    }


def _params_table(spec, viz_type) -> Dict[str, Any]:
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "query_mode": spec.get("query_mode", "aggregate"),
        "groupby": spec.get("dimensions", []),
        "metrics": _metric_list(spec),
        "all_columns": spec.get("columns", []),     # used when query_mode == "raw"
        "time_range": spec.get("time_range", "No filter"),
        "granularity_sqla": spec.get("time_col"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 1000),
        "order_desc": True,
        "table_timestamp_format": "smart_date",
        "show_cell_bars": True,
    }


def _params_pivot(spec, viz_type) -> Dict[str, Any]:
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "groupbyRows": spec.get("rows", spec.get("dimensions", [])),
        "groupbyColumns": spec.get("pivot_columns", []),
        "metrics": _metric_list(spec),
        "time_range": spec.get("time_range", "No filter"),
        "granularity_sqla": spec.get("time_col"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 10000),
        "aggregateFunction": spec.get("aggregate", "Sum"),
        "valueFormat": "SMART_NUMBER",
    }


def _params_single_metric(spec, viz_type) -> Dict[str, Any]:
    metrics = _metric_list(spec)
    p = {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "metric": metrics[0] if metrics else None,   # singular!
        "time_range": spec.get("time_range", "No filter"),
        "granularity_sqla": spec.get("time_col"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 100),
        "color_scheme": spec.get("color_scheme", "supersetColors"),
    }
    # pie / funnel / treemap / sunburst use groupby for slices
    if viz_type in ("pie", "funnel", "treemap_v2", "sunburst_v2"):
        p["groupby"] = spec.get("dimensions", [])
    if viz_type == "big_number_total":
        p["subheader"] = spec.get("subheader", "")
        p["header_font_size"] = 0.4
    if viz_type == "gauge_chart":
        p["min_val"] = spec.get("min_val", 0)
        p["max_val"] = spec.get("max_val", 100)
    return p


def _params_single_metric_ts(spec, viz_type) -> Dict[str, Any]:
    """big_number with a trendline."""
    metrics = _metric_list(spec)
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "metric": metrics[0] if metrics else None,
        "granularity_sqla": spec["time_col"],
        "time_range": spec.get("time_range", "No filter"),
        "time_grain_sqla": spec.get("time_grain", "P1D"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "subheader": spec.get("subheader", ""),
        "compare_lag": "",
        "show_trend_line": True,
    }


def _params_distribution(spec, viz_type) -> Dict[str, Any]:
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "metrics": _metric_list(spec),
        "groupby": spec.get("dimensions", []),
        "columns": spec.get("dimensions", []),
        "time_range": spec.get("time_range", "No filter"),
        "granularity_sqla": spec.get("time_col"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 10000),
        "whisker_options": "Tukey",
    }


def _params_heatmap(spec, viz_type) -> Dict[str, Any]:
    dims = spec.get("dimensions", [])
    metrics = _metric_list(spec)
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "x_axis": dims[0] if len(dims) > 0 else None,
        "groupby": dims[1] if len(dims) > 1 else None,
        "metric": metrics[0] if metrics else None,
        "time_range": spec.get("time_range", "No filter"),
        "granularity_sqla": spec.get("time_col"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 10000),
        "linear_color_scheme": "blue_white_yellow",
    }


def _params_geo(spec, viz_type) -> Dict[str, Any]:
    metrics = _metric_list(spec)
    dims = spec.get("dimensions", [])
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "entity": dims[0] if dims else None,   # country column
        "country_fieldtype": spec.get("country_fieldtype", "cca3"),
        "metric": metrics[0] if metrics else None,
        "time_range": spec.get("time_range", "No filter"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 10000),
    }


def _params_bubble(spec, viz_type) -> Dict[str, Any]:
    metrics = _metric_list(spec)
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "series": spec.get("series"),
        "entity": (spec.get("dimensions") or [None])[0],
        "x": metrics[0] if len(metrics) > 0 else None,
        "y": metrics[1] if len(metrics) > 1 else None,
        "size": metrics[2] if len(metrics) > 2 else None,
        "time_range": spec.get("time_range", "No filter"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 10000),
    }


def _params_raw(spec, viz_type) -> Dict[str, Any]:
    """histogram and other raw-column viz."""
    return {
        "datasource": f"{spec['dataset_id']}__table",
        "viz_type": viz_type,
        "column": (spec.get("columns") or _metric_list(spec) or [None])[0],
        "groupby": spec.get("dimensions", []),
        "time_range": spec.get("time_range", "No filter"),
        "adhoc_filters": _adhoc_filters(spec.get("filters")),
        "row_limit": spec.get("row_limit", 10000),
        "bins": spec.get("bins", 20),
    }


SHAPE_BUILDERS = {
    "timeseries":        _params_timeseries,
    "table":             _params_table,
    "pivot":             _params_pivot,
    "single_metric":     _params_single_metric,
    "single_metric_ts":  _params_single_metric_ts,
    "distribution":      _params_distribution,
    "heatmap":           _params_heatmap,
    "geo":               _params_geo,
    "bubble":            _params_bubble,
    "raw":               _params_raw,
}


# ---------------------------------------------------------------------------
# 4. QUERY CONTEXT BUILDER
# ---------------------------------------------------------------------------

def build_query_context(spec: Dict[str, Any], shape: str) -> Dict[str, Any]:
    is_ts = shape in ("timeseries", "single_metric_ts")
    metrics = _metric_list(spec)

    columns: List[str] = []
    if is_ts:
        columns = ([spec["time_col"]] if spec.get("time_col") else []) + spec.get("dimensions", [])
    else:
        columns = spec.get("dimensions", []) or spec.get("columns", [])

    query = {
        "time_range": spec.get("time_range", "No filter"),
        "granularity": spec.get("time_col"),
        "filters": _query_filters(spec.get("filters")),
        "extras": {
            "time_grain_sqla": spec.get("time_grain", "P1D"),
            "having": "",
            "where": "",
        },
        "columns": columns,
        "metrics": metrics,
        "orderby": [[metrics[0], False]] if metrics else [],
        "row_limit": spec.get("row_limit", 10000),
        "is_timeseries": is_ts,
    }
    return {
        "datasource": {"id": spec["dataset_id"], "type": "table"},
        "force": spec.get("force_refresh", False),
        "queries": [query],
        "result_format": "json",
        "result_type": "full",
    }


# ---------------------------------------------------------------------------
# 5. MAIN ENTRYPOINT
# ---------------------------------------------------------------------------

def build_chart_payload(spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Take a flat ChartSpec, return the full POST /api/v1/chart/ body
    with params + query_context already stringified.
    """
    key = spec["viz_type"]
    if key not in CHART_TYPES:
        raise ValueError(
            f"Unknown viz_type '{key}'. Valid keys: {', '.join(CHART_TYPES)}"
        )

    meta = CHART_TYPES[key]
    viz_type = meta["viz_type"]
    shape = meta["shape"]

    params = SHAPE_BUILDERS[shape](spec, viz_type)
    # apply any caller overrides
    params.update(spec.get("extra", {}))

    query_context = build_query_context(spec, shape)

    return {
        "slice_name": spec["name"],
        "viz_type": viz_type,
        "datasource_id": spec["dataset_id"],
        "datasource_type": "table",
        "owners": spec.get("owners", []),
        "params": json.dumps(params),
        "query_context": json.dumps(query_context),
    }


def list_chart_types() -> List[str]:
    return list(CHART_TYPES.keys())
