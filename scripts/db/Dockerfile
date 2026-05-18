FROM postgres:16-alpine

# auth + portfolio schemas (see scripts/db-init/)
COPY scripts/db-init/ /docker-entrypoint-initdb.d/
