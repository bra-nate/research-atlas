#!/usr/bin/env bash
# End-to-end smoke test for the Research Directory API against a real local
# Postgres: applies the migration, seeds a small graph, boots the API, and curls
# the read + graph endpoints (incl. the person→projects hero traversal).
set -euo pipefail
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
DB=ra_apitest
PORT=4577
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
API="$ROOT/apps/api"

ORG=11111111-1111-1111-1111-111111111111
PERSON=22222222-2222-2222-2222-222222222222
PROG=33333333-3333-3333-3333-333333333333
PROJ=44444444-4444-4444-4444-444444444444

psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists $DB;"
psql -h localhost -p 5432 -d postgres -X -q -c "create database $DB;"
psql -h localhost -p 5432 -d $DB -v ON_ERROR_STOP=1 -X -q -f "$ROOT/supabase/migrations/0001_init.sql" >/dev/null

psql -h localhost -p 5432 -d $DB -v ON_ERROR_STOP=1 -X -q -c "
insert into organizations (id,name,short_name,org_type,country) values ('$ORG','WACCBIP','WACCBIP','university','Ghana');
insert into people (id,full_name,primary_org_id,specializations,skills) values ('$PERSON','Gordon Awandare','$ORG','{genomics}','{malaria}');
insert into programs (id,name,short_name) values ('$PROG','H3Africa','H3A');
insert into projects (id,title,program_id,lead_org_id,pi_person_id,country) values ('$PROJ','SickleGenAfrica','$PROG','$ORG','$PERSON','Ghana');
insert into project_members (project_id,person_id,role) values ('$PROJ','$PERSON','pi');
insert into capabilities (org_id,kind,name,category,city,country) values ('$ORG','equipment','Sequencer','genomics','Accra','Ghana');
insert into grants (name,funder_org_id,amount,currency) values ('Wellcome Award','$ORG',500000,'USD');
" >/dev/null

cd "$API"
DATABASE_URL="postgres://$(whoami)@localhost:5432/$DB" PORT=$PORT WEB_ORIGIN="http://localhost:5173" \
  node --import tsx src/index.ts &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true; psql -h localhost -p 5432 -X -q -d postgres -c "drop database if exists '$DB';" >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 30); do curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1 && break; sleep 0.3; done

BASE="http://localhost:$PORT/api"
pass=0; fail=0
ck(){ if [ "$2" = "$3" ]; then echo "  ✓ $1 ($3)"; pass=$((pass+1)); else echo "  ✗ $1 — expected $2 got $3"; fail=$((fail+1)); fi; }
code(){ curl -s -o /dev/null -w "%{http_code}" "$@"; }
jqlen(){ curl -s "$1" | grep -o '"id"' | wc -l | tr -d ' '; }

echo "### Tests"
ck "GET /organizations" 200 "$(code "$BASE/organizations")"
ck "organizations has 1" 1 "$(jqlen "$BASE/organizations")"
ck "GET /organizations/facets" 200 "$(code "$BASE/organizations/facets")"
ck "GET /people" 200 "$(code "$BASE/people")"
ck "GET /programs" 200 "$(code "$BASE/programs")"
ck "GET /projects" 200 "$(code "$BASE/projects")"
ck "GET /capabilities" 200 "$(code "$BASE/capabilities")"
ck "GET /grants" 200 "$(code "$BASE/grants")"
ck "GET /publications" 200 "$(code "$BASE/publications")"
# hero: person → projects (across programmes)
HERO=$(curl -s "$BASE/people/$PERSON/projects")
echo "  person→projects payload: $HERO"
ck "person→projects returns SickleGenAfrica" 1 "$(echo "$HERO" | grep -c 'SickleGenAfrica')"
ck "project→members returns the PI" 1 "$(curl -s "$BASE/projects/$PROJ/members" | grep -c 'Gordon Awandare')"
ck "search people q=malaria finds 1" 1 "$(jqlen "$BASE/people?q=malaria")"
ck "provenance label present (ingested_unverified)" 1 "$(curl -s "$BASE/organizations" | grep -c 'ingested_unverified')"

echo "### Result: $pass passed, $fail failed"
[ "$fail" = "0" ]
