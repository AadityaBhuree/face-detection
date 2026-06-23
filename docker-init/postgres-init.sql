-- AyuTalk Care — PostgreSQL Initialization
-- Enable required extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS ayutalk;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
ALTER DATABASE ayutalk_care SET search_path TO ayutalk, public, audit;
