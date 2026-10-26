// PM2 설정: 기존 서비스와 분리된 "roomfit" 프로세스 하나로 실행한다.
const PORT = process.env.ROOMFIT_PORT || "3100";
// 0.0.0.0: http://서버IP:포트 로 바로 접속. Nginx로 연결한 뒤에는 127.0.0.1 권장
const HOST = process.env.ROOMFIT_HOST || "0.0.0.0";

module.exports = {
  apps: [
    {
      name: "roomfit",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      // deploy.sh가 고른 Node(서버 Node가 20 미만이면 Roomfit 전용 Node)
      interpreter: process.env.ROOMFIT_NODE || "node",
      args: `start -p ${PORT} -H ${HOST}`,
      // 내장 SQLite의 "실험 기능" 경고를 로그에서 숨긴다
      node_args: "--disable-warning=ExperimentalWarning",
      env: {
        NODE_ENV: "production",
        PORT,
        // 회원·방 데이터 파일 (코드 폴더 밖)
        ROOMFIT_DB: process.env.ROOMFIT_DB || require("path").join(require("os").homedir(), "roomfit-data", "roomfit.db"),
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
    },
  ],
};
