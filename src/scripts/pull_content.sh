#!/usr/bin/env bash
# Replaces the dictionary content of the local Supabase with the production content, since
# production is where the pipeline publishes:
#
#     src/scripts/pull_content.sh
#
# Only the content tables are copied. Local accounts, favorites and familiarity stay, though rows
# for words that no longer exist are left pointing at nothing. Reads the production DATABASE_URL
# from src/.env.production and needs the local Supabase running, whose container has the Postgres
# tools that match the production version.
#
# Not while the pipeline runs on the local database: what it writes between the export and the
# replacement would be lost.

set -euo pipefail

cd "$(dirname "$0")/.."

if pgrep -f "scripts.process_vocabulary|run_batches.sh|scripts.check_morphology" >/dev/null; then
  echo "The pipeline is running; pull the content once it has finished." >&2
  exit 1
fi
container=supabase_db_kinlex
tables=(
  words word_slug_redirects senses morphemes word_morphemes examples example_translations
  example_links example_tokens example_token_glosses audio tags word_tags word_embeddings
)

production_url=$(sed -n 's/^DATABASE_URL=//p' .env.production 2>/dev/null | tail -1 | tr -d "\"'")
if [[ -z $production_url ]]; then
  echo "src/.env.production needs the production DATABASE_URL" >&2
  exit 1
fi

table_args=()
deletes=""
for table in "${tables[@]}"; do
  table_args+=(-t "public.$table")
  deletes+="delete from public.$table;"
done

dump=$(mktemp)
trap 'rm -f "$dump"' EXIT

echo "Exporting the production content..."
docker exec -e PRODUCTION_URL="$production_url" "$container" \
  sh -c 'pg_dump "$PRODUCTION_URL" --data-only --no-owner --no-privileges "$@"' sh \
  "${table_args[@]}" >"$dump"

# Replication mode turns off foreign key checks and cascades, so the tables can be emptied and
# filled in any order without touching the user tables that point at words.
echo "Replacing the local content..."
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 --single-transaction -q \
  -c "set session_replication_role = replica" -c "$deletes" -f - <"$dump"

docker exec "$container" psql -U postgres -At -c \
  "select 'local now has ' || (select count(*) from public.words) || ' words and '
     || (select count(*) from public.examples) || ' examples'"
