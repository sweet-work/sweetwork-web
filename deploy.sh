#!/usr/bin/env bash
# sweetwork-web 배포 스크립트 — 최신 코드 받아 컨테이너 재빌드·기동
# 사용법:  ./deploy.sh [브랜치]   (기본 main, 예: ./deploy.sh develop)
set -euo pipefail

# 스크립트가 어디서 호출되든 자기 폴더(=프로젝트 루트)로 이동
cd "$(dirname "$0")"

BRANCH="${1:-main}"

echo "▶ 배포 시작 (branch: $BRANCH)"

echo "▶ 최신 코드 받는 중..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "▶ 컨테이너 빌드·기동 중..."
docker compose up -d --build

echo "▶ 사용 안 하는 이미지 정리..."
docker image prune -f

echo "▶ 상태:"
docker compose ps

echo "✅ 배포 완료 (branch: $BRANCH)"
