-- supabase/migrations/20261101000001_extensions.sql

create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;