-- ==============================================================================
-- EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  
CREATE EXTENSION IF NOT EXISTS vector;       

-- ==============================================================================
-- 1. CONFIGURATION & ROUTING TABLES (Zero-Dev Control Plane)
-- ==============================================================================

-- 1.1 SYSTEM SKILLS REGISTRY (The Tool Dictionary & UI Grouper)
-- This holds ALL available subskills.
CREATE TABLE system_skills_registry (
    skill_code VARCHAR(50) PRIMARY KEY,       -- EXECUTION ID: e.g., 'M01.2_BOM_Normalize'
    user_input JSONB NOT NULL,
    skill_name VARCHAR(100) NOT NULL,         -- UI LABEL: e.g., 'Normalize Through-Hole BOM'
    
    
    -- [NEW] PRESENTATION: Groups subskills for the Accomplish UI accordions
    macro_category VARCHAR(100) NOT NULL,     -- UI GROUP: e.g., 'M01_Intake_and_Normalization'
    
    -- The exact name of the FastMCP tool OpenHarness routes to
    mcp_tool_name VARCHAR(100) NOT NULL,      -- e.g., 'normalize_bom_mcp'
    
    -- If true, OpenHarness wakes the LLM. If false, strictly Python.
    requires_llm BOOLEAN DEFAULT FALSE,       
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.2 QUOTE ROUTING PROFILES (The Saved Flow / DMR Sequence)
-- The UI generates this by taking checked boxes and flattening them. 
-- Dify reads this to run its sequential loop.
CREATE TABLE quote_routing_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_name VARCHAR(100) UNIQUE NOT NULL, 
    
    -- The flattened execution array: '["M01.1_REPEL", "M01.2_BOM_Normalize", "M02.2_FreeCAD"]'
    routing_sequence JSONB NOT NULL,           
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.3 CLIENT BUSINESS RULES (The Variables)
-- FastMCP Python scripts query this table directly for their thresholds/keys.
CREATE TABLE client_business_rules (
    rule_key VARCHAR(100) PRIMARY KEY,         -- e.g., 'manufacturing_limits'
    rule_value JSONB NOT NULL,                 -- e.g., '{"max_layers": 12, "margin": 22.5}'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 2. STATE & EXECUTION TABLES (The Scratchpad)
-- ==============================================================================

-- 2.1 RFQ MASTER
CREATE TABLE rfq_master (
    rfq_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfq_number VARCHAR(50) UNIQUE NOT NULL,
    profile_id UUID REFERENCES quote_routing_profiles(profile_id),
    status VARCHAR(50) DEFAULT 'Pending Intake', 
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 RFQ MANIFEST (The Input Sieve)
CREATE TABLE rfq_manifest (
    manifest_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfq_id UUID REFERENCES rfq_master(rfq_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,                   -- e.g., /staged/inbox/bom.xlsx
    file_type VARCHAR(50) NOT NULL,
    is_securely_cleared BOOLEAN DEFAULT FALSE, 
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.3 DMR EXECUTION STATE (The Handoff Tracker)
-- Dify updates this after every successful subskill execution.
CREATE TABLE dmr_execution_state (
    state_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfq_id UUID REFERENCES rfq_master(rfq_id) ON DELETE CASCADE,
    current_skill_index INT NOT NULL DEFAULT 0,
    active_skill_code VARCHAR(50),
    step_status VARCHAR(50) DEFAULT 'Pending', -- 'Running', 'Success', 'Failed'
    latest_payload JSONB,                      
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.4 THE UNIFIED SCHEMA CONTRACT (Final Output)
CREATE TABLE unified_quote_package (
    cbom_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfq_id UUID REFERENCES rfq_master(rfq_id) ON DELETE CASCADE UNIQUE,
    costed_bom JSONB NOT NULL,                 
    extracted_features JSONB,                  
    risk_register JSONB,                       
    approved_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 3. SEMANTIC MEMORY (pgvector Storage)
-- ==============================================================================

-- 3.1 HISTORICAL COMPONENT MEMORY (For Value Engineering)
CREATE TABLE historical_component_memory (
    component_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    internal_mpn VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    material_specs TEXT,
    last_paid_price NUMERIC(10, 2),
    semantic_embedding VECTOR(768),            
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON historical_component_memory USING hnsw (semantic_embedding vector_cosine_ops);

-- 3.2 INTERNAL POLICY MEMORY (For ITAR / ERP Rules)
CREATE TABLE internal_policy_memory (
    doc_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_title VARCHAR(200),
    chunk_text TEXT NOT NULL,
    chunk_embedding VECTOR(768)
);
CREATE INDEX ON internal_policy_memory USING hnsw (chunk_embedding vector_cosine_ops);