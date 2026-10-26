// 사용: node deploy/backup-db.cjs <원본 DB> <백업 파일>
// 실행 중인 서버가 DB를 쓰고 있어도 일관된 사본을 만든다 (SQLite VACUUM INTO).
const { DatabaseSync } = require("node:sqlite");
const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("사용법: node deploy/backup-db.cjs <원본> <백업>");
  process.exit(1);
}
const db = new DatabaseSync(src);
db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
db.close();
