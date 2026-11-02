#!/bin/sh
# Container start-up: schema first, then data, then the server.
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

# The workbook import is idempotent (the same file is skipped), so it is safe on every start.
if [ "${IMPORT_ON_START:-true}" = "true" ]; then
  echo "Loading the college timetable workbook..."
  node scripts/import-timetable.js || echo "Workbook import failed; the API will still start."
fi

exec "$@"
