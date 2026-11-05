-- Dictionary content can only be read through the web server. The anon key ships with the site, so
-- with read access granted to anon anyone could page through every word over the REST API. The
-- server now sends a secret key with each request, and the content tables are only readable when
-- that key is registered here. The published-only policies stay as they were: these checks are
-- restrictive policies, which apply on top of them.

create schema if not exists private;
revoke all on schema private from public;
-- Policies run as the caller, who must be able to reach the key check.
grant usage on schema private to anon, authenticated;

-- One row per server key, stored as the hex SHA-256 of the key, so several keys can be valid while
-- one is rotated. Register a key with:
--   insert into private.server_keys (key_hash, label)
--   values (encode(sha256(convert_to('<key>', 'UTF8')), 'hex'), '<where it is used>');
create table private.server_keys (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (btrim(label) <> ''),
  created_at timestamptz not null default now()
);

alter table private.server_keys enable row level security;
revoke all on table private.server_keys from public, anon, authenticated;

create function private.is_server_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.server_keys
    where server_keys.key_hash = encode(
      sha256(
        convert_to(
          coalesce(
            nullif(current_setting('request.headers', true), '')::json ->> 'x-kinlex-server-key',
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    )
  );
$$;

revoke execute on function private.is_server_request() from public;
grant execute on function private.is_server_request() to anon, authenticated;

-- Wrapped in a select so the check runs once per query rather than once per row.
create policy words_server_only
  on public.words as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy word_slug_redirects_server_only
  on public.word_slug_redirects as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy senses_server_only
  on public.senses as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy morphemes_server_only
  on public.morphemes as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy word_morphemes_server_only
  on public.word_morphemes as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy examples_server_only
  on public.examples as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy example_translations_server_only
  on public.example_translations as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy example_links_server_only
  on public.example_links as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy example_tokens_server_only
  on public.example_tokens as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy example_token_glosses_server_only
  on public.example_token_glosses as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy audio_server_only
  on public.audio as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy tags_server_only
  on public.tags as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

create policy word_tags_server_only
  on public.word_tags as restrictive for select to anon, authenticated
  using ((select private.is_server_request()));

-- The token tables were created without explicit grants and picked up the schema defaults, which
-- include truncate; row level security does not cover truncate. Leave them readable only, like the
-- other content tables.
revoke all on table public.example_tokens, public.example_token_glosses from anon, authenticated;
grant select on table public.example_tokens, public.example_token_glosses to anon, authenticated;
