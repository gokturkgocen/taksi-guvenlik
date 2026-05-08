#!/usr/bin/env bash
# Phase 2 deploy: build Docker image locally, push to EC2 via scp+ssh, restart container.
#
# Prereqs on EC2 host:
#   - Docker installed (sudo amazon-linux-extras install docker; sudo systemctl start docker)
#   - User in docker group (sudo usermod -aG docker $USER, re-login)
#   - Port 8000 (or 80/443 if using reverse proxy) open in security group
#   - ~/data directory created for persistent embeddings.pkl
#
# Required env:
#   EC2_HOST="ec2-user@1.2.3.4"
#   KEY_PATH="~/.ssh/taxi-key.pem"

set -euo pipefail

EC2_HOST="${EC2_HOST:?Set EC2_HOST=user@ip}"
KEY_PATH="${KEY_PATH:?Set KEY_PATH=/path/to/key.pem}"

cd "$(dirname "$0")"

echo "[deploy] building Docker image"
docker build --platform linux/amd64 -t taxi-server:latest .

echo "[deploy] saving image"
docker save taxi-server:latest | gzip > taxi-server.tar.gz

echo "[deploy] copying to $EC2_HOST"
scp -i "$KEY_PATH" taxi-server.tar.gz "$EC2_HOST:~/"

echo "[deploy] restarting container on $EC2_HOST"
ssh -i "$KEY_PATH" "$EC2_HOST" bash -s <<'REMOTE'
set -e
mkdir -p ~/data
docker load < taxi-server.tar.gz
docker stop taxi-server 2>/dev/null || true
docker rm   taxi-server 2>/dev/null || true
docker run -d --name taxi-server -p 8000:8000 \
    -v "$HOME/data:/app/data" \
    -e DB_PATH=/app/data/embeddings.pkl \
    --restart unless-stopped \
    taxi-server:latest
rm taxi-server.tar.gz
docker ps --filter name=taxi-server
REMOTE

rm taxi-server.tar.gz
echo "[deploy] done"
echo "test: curl http://${EC2_HOST#*@}:8000/health"
