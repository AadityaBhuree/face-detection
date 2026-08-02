-- Jeevandata — PostgreSQL Initialization
-- Enable required extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS jeevandata;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
ALTER DATABASE jeevandata SET search_path TO jeevandata, public, audit;
