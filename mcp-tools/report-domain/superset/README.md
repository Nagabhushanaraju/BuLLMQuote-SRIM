# Dashboard MCP Server (Apache Superset behind it)

Your product sits in the middle. A **client agent** makes a structured
**MCP tool call** to *your* server. They don't know Apache Superset — they
only fill a flat, friendly schema. Your server turns that into Apache
Superset charts + a dashboard and returns a **dashboard URL**.

```
client agent  ──MCP call──▶  YOUR MCP SERVER  ──REST──▶  Apache Superset
   (fills ChartSpec)          (this code)                (charts/dashboards)
        ▲                                                      │
        └────────────  dashboard_url returned  ◀──────────────┘
```

> Note on the name collision: the `superset.sh` MCP docs describe an
> *unrelated* agentic dev tool (tasks/workspaces/automations — no charts).
> We borrowed only its **conventions** (snake_case tool names, Bearer
> `sk_live_` API-key auth, JSON in/out). The actual charting is done by
> **Apache Superset** via its REST API.

## Files

| File | Role |
|------|------|
| `mcp_tool_contract.json` | **The contract clients code against.** Tool names + JSON input/output schemas. This is "the structure they call." |
| `mcp_server.py` | The MCP server exposing those tools. Translates each call and runs it against Apache Superset. |
| `superset_client.py` | REST client doing the real work (auth, charts, dashboard layout, embed, dataset discovery). |
| `chart_templates.py` | Boilerplate for all 20 chart types -> valid Superset chart payloads. |
| `example_call.json` | What a client sends to `dashboard_generate`. |
| `example_response.json` | What your server returns. |
| `chartspec.schema.json` | Standalone JSON Schema for a single ChartSpec. |
| `example_usage.py` | Offline dry-run printer for chart payloads. |

## The three tools your server exposes

| Tool | Purpose |
|------|---------|
| `dashboard_generate` | Build charts + dashboard, return a shareable URL. (primary) |
| `chart_data_query` | Run one query, return raw rows (client renders itself). |
| `datasets_list` | Discover datasets, columns, and metrics to build valid specs. |

## What a client sends (the structure they call)

```json
{
  "title": "Sales Overview",
  "dataset": "orders",
  "layout_columns": 2,
  "charts": [
    { "name": "Revenue Trend", "type": "line",
      "metrics": ["total_amount"], "dimensions": ["region"],
      "time_column": "order_date", "time_range": "Last 15 days" },
    { "name": "Total Revenue", "type": "big_number",
      "metrics": ["total_amount"], "time_range": "Last 15 days" }
  ],
  "embed": { "allowed_domains": ["https://yourapp.com"] }
}
```

Full field reference: `mcp_tool_contract.json` (`$defs/ChartSpec`).
Chart types: line, bar, area, scatter, smooth_line, table, pivot_table,
big_number, big_number_trend, pie, funnel, gauge, histogram, box_plot,
heatmap, treemap, sunburst, world_map, mixed_timeseries, bubble.

## What your server returns

```json
{
  "dashboard_id": 42,
  "dashboard_url": "https://your-superset-host/superset/dashboard/42/",
  "standalone_url": "https://.../42/?standalone=1",
  "charts": [{ "id": 101, "name": "Revenue Trend" }],
  "embed_uuid": "...", "guest_token": "..."
}
```

Send `dashboard_url` to the end user. Use `standalone_url` +
`embed_uuid` + `guest_token` with the Superset Embedded SDK for in-UI iframes.

## Run it

```bash
pip install mcp requests
export SUPERSET_URL=https://your-apache-superset-host
export SUPERSET_USER=admin
export SUPERSET_PASSWORD=admin
python mcp_server.py        # serves MCP over HTTP at :8000/mcp
```

Clients connect to `http://your-host:8000/mcp`. Auth conventions
(OAuth 2.1 interactive, or `Authorization: Bearer sk_live_...` for headless)
follow the superset.sh format; wire your gateway/auth in front as needed.

## Prerequisite in Apache Superset

Metrics referenced in specs (`total_amount`, `count`, ...) must be defined
on the dataset once via `PUT /api/v1/dataset/{id}`. Clients can discover
what's available by calling `datasets_list` first.
