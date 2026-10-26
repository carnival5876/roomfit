#!/usr/bin/env bash
# Roomfit 배포 스크립트 (서버에서 프로젝트 폴더 안에서 실행)
#   bash deploy/deploy.sh            → 기본 포트 3100
#   ROOMFIT_PORT=3200 bash deploy/deploy.sh
# 기존 PM2 프로세스는 건드리지 않고 "roomfit" 하나만 시작/재시작한다.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${ROOMFIT_PORT:-3100}"
export ROOMFIT_PORT="$PORT"
export ROOMFIT_HOST="${ROOMFIT_HOST:-0.0.0.0}"

echo "▶ Node 버전 확인"
# Roomfit은 Node 내장 SQLite를 쓰므로 Node 22.13 이상이 필요하다.
# 서버의 기본 Node가 그보다 낮으면 Roomfit 전용 Node를 ~/.roomfit-node 에 받아 쓴다.
# 서버 전체 Node는 바꾸지 않으므로 기존 앱·웹에는 영향이 없다.
ROOMFIT_NODE_VERSION="v22.22.0"
SYS_MAJOR=0
SYS_OK=no
if command -v node >/dev/null; then
  SYS_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  SYS_OK=$(node -p 'const [a,b]=process.versions.node.split(".").map(Number); (a>22||(a===22&&b>=13))?"yes":"no"')
fi
if [ "$SYS_OK" = "yes" ] && [ -z "${ROOMFIT_FORCE_LOCAL_NODE:-}" ]; then
  NODE_BIN="$(command -v node)"
  echo "  서버 Node $(node -v) 사용"
else
  case "$(uname -m)" in
    x86_64|amd64) NARCH=x64 ;;
    aarch64|arm64) NARCH=arm64 ;;
    *) echo "✗ 지원하지 않는 CPU: $(uname -m)"; exit 1 ;;
  esac
  NODE_DIR="$HOME/.roomfit-node/node-$ROOMFIT_NODE_VERSION-linux-$NARCH"
  if [ ! -x "$NODE_DIR/bin/node" ]; then
    echo "  서버 Node가 $( [ "$SYS_MAJOR" -gt 0 ] && node -v || echo '없음') 이라 Roomfit 전용 Node $ROOMFIT_NODE_VERSION 을 받습니다 (기존 서비스 영향 없음)"
    mkdir -p "$HOME/.roomfit-node"
    URL="https://nodejs.org/dist/$ROOMFIT_NODE_VERSION/node-$ROOMFIT_NODE_VERSION-linux-$NARCH.tar.gz"
    if command -v curl >/dev/null; then curl -fsSL "$URL" | tar -xz -C "$HOME/.roomfit-node"
    else wget -qO- "$URL" | tar -xz -C "$HOME/.roomfit-node"; fi
  fi
  NODE_BIN="$NODE_DIR/bin/node"
  echo "  Roomfit 전용 Node $("$NODE_BIN" -v) 사용"
fi
# 이 스크립트 안의 node/npm은 Roomfit용 Node를 쓴다. PM2 실행에도 같은 Node를 넘긴다.
export PATH="$(dirname "$NODE_BIN"):$PATH"
export ROOMFIT_NODE="$NODE_BIN"

# 회원·방 데이터는 코드 폴더 밖에 둔다 (재배포해도 유지)
export ROOMFIT_DB="${ROOMFIT_DB:-$HOME/roomfit-data/roomfit.db}"
mkdir -p "$(dirname "$ROOMFIT_DB")"
echo "  데이터 파일: $ROOMFIT_DB"

command -v pm2 >/dev/null || { echo "✗ PM2가 없습니다: npm i -g pm2"; exit 1; }

echo "▶ 포트 $PORT 확인"
RUNNING_HERE=$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).some(p=>p.name==="roomfit")?"yes":"no")}catch{console.log("no")}})')
PORT_BUSY=$(node -e 'const s=require("net").createServer();s.once("error",()=>{console.log("yes")});s.listen(+process.argv[1],()=>{s.close();console.log("no")})' "$PORT")
if [ "$RUNNING_HERE" = "no" ] && [ "$PORT_BUSY" = "yes" ]; then
  echo "✗ 포트 $PORT 를 다른 프로그램이 쓰고 있습니다. 다른 포트로 실행하세요:"
  echo "  ROOMFIT_PORT=3200 bash deploy/deploy.sh"
  exit 1
fi

echo "▶ 패키지 설치"
npm ci --no-audit --no-fund

echo "▶ 빌드"
npm run build

echo "▶ 데이터 백업"
if [ -f "$ROOMFIT_DB" ]; then
  BK="$(dirname "$ROOMFIT_DB")/backup"
  mkdir -p "$BK"
  "$NODE_BIN" --disable-warning=ExperimentalWarning deploy/backup-db.cjs "$ROOMFIT_DB" "$BK/roomfit-$(date +%Y%m%d-%H%M%S).db"
  ls -1t "$BK"/roomfit-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f   # 최근 10개만 보관
  echo "  백업 완료 (최근 10개 보관: $BK)"
else
  echo "  첫 배포라 백업할 데이터가 없습니다"
fi

echo "▶ PM2 시작"
if [ "$RUNNING_HERE" = "yes" ]; then
  pm2 delete roomfit >/dev/null   # 포트 변경도 반영되도록 다시 등록
fi
pm2 start deploy/ecosystem.config.cjs
pm2 save >/dev/null

echo "▶ 동작 확인"
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then
    echo "✓ Roomfit 실행 중 (포트 $PORT)"
    if [ "$ROOMFIT_HOST" = "0.0.0.0" ]; then
      IP=$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
      echo "  브라우저에서: http://$IP:$PORT"
      echo "  안 열리면 방화벽에서 $PORT 포트를 여세요 (deploy/DEPLOY.md 참고)"
    fi
    exit 0
  fi
  sleep 1
done
echo "✗ 응답이 없습니다. 로그 확인: pm2 logs roomfit --lines 50"
exit 1
