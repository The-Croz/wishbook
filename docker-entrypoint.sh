#!/bin/sh
# Starts as root only long enough to make /data writable, then runs the app as PUID:PGID (default 1000:1000).
set -e
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
DATA_DIR="$(dirname "${DATABASE_PATH:-/data/wishbook.db}")"

if [ "$(id -u)" = "0" ]; then
	mkdir -p "$DATA_DIR"
	if [ "$(stat -c %u:%g "$DATA_DIR")" != "$PUID:$PGID" ]; then
		echo "[wishbook] giving $DATA_DIR to $PUID:$PGID"
		chown -R "$PUID:$PGID" "$DATA_DIR"
	fi
	exec su-exec "$PUID:$PGID" "$@"
fi

if [ ! -w "$DATA_DIR" ]; then
	echo "[wishbook] $DATA_DIR is not writable by uid $(id -u). Run: chown -R $(id -u):$(id -g) <your data folder>" >&2
	exit 1
fi
exec "$@"
