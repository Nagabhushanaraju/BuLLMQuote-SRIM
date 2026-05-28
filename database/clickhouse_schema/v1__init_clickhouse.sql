-- ==============================================================================
-- 1. TELEMETRY & HARDWARE AUDIT
-- ==============================================================================
CREATE TABLE mcp_execution_logs (
    event_time DateTime64(3) DEFAULT now(),
    rfq_id UUID,
    skill_code String,
    mcp_tool_name String,                      -- e.g., 'normalize_bom_mcp'
    llm_was_used UInt8,                        -- 1 for Yes, 0 for No
    execution_time_ms UInt32,
    cpu_usage_percent Float32,
    memory_used_mb Float32,
    status String,                             -- 'Success', 'Timeout', 'Error'
    error_message String
) ENGINE = MergeTree()
ORDER BY (event_time, rfq_id, skill_code);

-- ==============================================================================
-- 2. COMPLIANCE AUDIT
-- ==============================================================================
CREATE TABLE repel_security_audit (
    event_time DateTime64(3) DEFAULT now(),
    rfq_id UUID,
    file_name String,
    redactions_made UInt16,
    flagged_keywords Array(String),
    action_taken String                        
) ENGINE = MergeTree()
ORDER BY (event_time, rfq_id);

-- ==============================================================================
-- 3. WORKFLOW ANALYTICS
-- ==============================================================================
CREATE TABLE quote_lifecycle_events (
    event_time DateTime64(3) DEFAULT now(),
    rfq_id UUID,
    event_type String,                         
    user_or_agent String,                      
    duration_since_last_step_sec UInt32
) ENGINE = MergeTree()
ORDER BY (event_time, rfq_id);