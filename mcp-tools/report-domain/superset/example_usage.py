"""
example_usage.py
----------------
Shows the exact "flat spec" your callers fill in, one per chart type,
and how to turn the whole set into a dashboard URL.

Run `python example_usage.py` to print the generated payloads
WITHOUT hitting a live Superset (dry run). Set LIVE=True + creds to
actually create the dashboard.
"""

import json
from chart_templates import build_chart_payload, list_chart_types

DATASET_ID = 5  # your dataset id

# ---------------------------------------------------------------------------
# One example spec for EVERY chart type. Callers copy + edit these.
# ---------------------------------------------------------------------------
EXAMPLE_SPECS = [
    {
        "name": "Revenue Trend (15d)",
        "viz_type": "line",
        "dataset_id": DATASET_ID,
        "time_col": "order_date",
        "time_range": "Last 15 days",
        "metrics": ["total_amount"],
        "dimensions": ["region"],
    },
    {
        "name": "Revenue by Region (Bar)",
        "viz_type": "bar",
        "dataset_id": DATASET_ID,
        "time_col": "order_date",
        "time_range": "Last 15 days",
        "metrics": ["total_amount"],
        "dimensions": ["region"],
    },
    {
        "name": "Cumulative Area",
        "viz_type": "area",
        "dataset_id": DATASET_ID,
        "time_col": "order_date",
        "time_range": "Last 30 days",
        "metrics": ["total_amount"],
    },
    {
        "name": "Total Revenue",
        "viz_type": "big_number",
        "dataset_id": DATASET_ID,
        "time_range": "Last 15 days",
        "metrics": ["total_amount"],
        "subheader": "Last 15 days",
    },
    {
        "name": "Revenue Trend KPI",
        "viz_type": "big_number_trend",
        "dataset_id": DATASET_ID,
        "time_col": "order_date",
        "time_range": "Last 30 days",
        "metrics": ["total_amount"],
    },
    {
        "name": "Share by Region",
        "viz_type": "pie",
        "dataset_id": DATASET_ID,
        "time_range": "Last 15 days",
        "metrics": ["total_amount"],
        "dimensions": ["region"],
    },
    {
        "name": "Orders Table",
        "viz_type": "table",
        "dataset_id": DATASET_ID,
        "time_col": "order_date",
        "time_range": "Last 15 days",
        "metrics": ["total_amount", "count"],
        "dimensions": ["region", "product"],
    },
    {
        "name": "Region x Product Pivot",
        "viz_type": "pivot_table",
        "dataset_id": DATASET_ID,
        "time_range": "Last 15 days",
        "metrics": ["total_amount"],
        "rows": ["region"],
        "pivot_columns": ["product"],
    },
    {
        "name": "Conversion Funnel",
        "viz_type": "funnel",
        "dataset_id": DATASET_ID,
        "metrics": ["count"],
        "dimensions": ["stage"],
    },
    {
        "name": "Target Gauge",
        "viz_type": "gauge",
        "dataset_id": DATASET_ID,
        "metrics": ["total_amount"],
        "max_val": 100000,
    },
    {
        "name": "Amount Distribution",
        "viz_type": "histogram",
        "dataset_id": DATASET_ID,
        "columns": ["amount"],
        "bins": 30,
    },
    {
        "name": "Region Heatmap",
        "viz_type": "heatmap",
        "dataset_id": DATASET_ID,
        "metrics": ["total_amount"],
        "dimensions": ["region", "product"],
    },
    {
        "name": "Sales by Country",
        "viz_type": "world_map",
        "dataset_id": DATASET_ID,
        "metrics": ["total_amount"],
        "dimensions": ["country_code"],
    },
]


def dry_run():
    print("Supported chart types:")
    print(" ", ", ".join(list_chart_types()))
    print("\n" + "=" * 70)
    for spec in EXAMPLE_SPECS:
        payload = build_chart_payload(spec)
        print(f"\n### {spec['name']}  ({spec['viz_type']} -> {payload['viz_type']})")
        print("POST /api/v1/chart/")
        print(json.dumps({
            **{k: v for k, v in payload.items()
               if k not in ("params", "query_context")},
            "params": json.loads(payload["params"]),
            "query_context": json.loads(payload["query_context"]),
        }, indent=2)[:1400])
        print("-" * 70)


def live_run():
    from superset_client import SupersetClient
    client = SupersetClient(
        base_url="https://your-superset-host",
        username="admin",
        password="admin",
    )
    result = client.generate_dashboard(
        title="Sales Overview",
        chart_specs=EXAMPLE_SPECS,
        cols_per_row=2,
        embed_domains=["https://yourapp.com"],
        rls=[{"clause": "region = 'West'"}],
    )
    print(json.dumps(result, indent=2))
    print("\nSHARE THIS:", result["dashboard_url"])


if __name__ == "__main__":
    LIVE = False
    if LIVE:
        live_run()
    else:
        dry_run()
