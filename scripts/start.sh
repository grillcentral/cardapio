#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "Running database seed (idempotent)..."
node_modules/.bin/tsx prisma/seed.ts || echo "Seed skipped or already done"

echo "Starting application..."
exec npm start
