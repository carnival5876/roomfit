import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

// SQLite(Node 내장) 저장소. DB 접근은 이 폴더(src/server)에만 둔다.
// PostgreSQL로 옮길 때는 repo.ts의 함수 구현만 바꾸면 된다.
//
// DB 파일 위치: ROOMFIT_DB 환경변수, 없으면 ./data/roomfit.db
// 서버 배포 시에는 코드 폴더 밖(~/roomfit-data)에 두어 재배포해도 지워지지 않게 한다.

const DB_PATH = process.env.ROOMFIT_DB || path.join(process.cwd(), "data", "roomfit.db");

const g = globalThis as unknown as { __roomfitDb?: DatabaseSync };

function open(): DatabaseSync {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      scene_data  TEXT NOT NULL,   -- SceneData JSON (schemaVersion 포함)
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS projects_user ON projects(user_id, updated_at);
  `);
  return db;
}

export function db(): DatabaseSync {
  return (g.__roomfitDb ??= open());
}
