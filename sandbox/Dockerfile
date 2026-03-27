FROM postgres:16

# Install build dependencies and HypoPG from source
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    postgresql-server-dev-16 \
    git \
    ca-certificates \
    && git clone https://github.com/HypoPG/hypopg.git /tmp/hypopg \
    && cd /tmp/hypopg \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/hypopg \
    && apt-get purge -y build-essential postgresql-server-dev-16 git \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy initialization scripts (run in alphabetical order on first start)
COPY init-scripts/ /docker-entrypoint-initdb.d/
