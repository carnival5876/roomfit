import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { SceneData } from "@/lib/types";
import { DEFAULT_SCENE } from "@/lib/sceneSchema";

export type UserRow = { id: string; email: string; display_name: string; password_hash: string; created_at: string };
export type PublicUser = { id: string; email: string; displayName: string };
export type ProjectDto = { id: string; name: string; scene: SceneData; updatedAt: string };

const now = () => new Date().toISOString();
export const toPublic = (u: UserRow): PublicUser => ({ id: u.id, email: u.email, displayName: u.display_name });

// ---------- users ----------
export function findUserByEmail(email: string): UserRow | undefined {
  return db().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function createUser(email: string, displayName: string, passwordHash: string): UserRow {
  const u: UserRow = { id: randomUUID(), email, display_name: displayName, password_hash: passwordHash, created_at: now() };
  db().prepare("INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(u.id, u.email, u.display_name, u.password_hash, u.created_at);
  return u;
}

// ---------- sessions ----------
export function createSession(tokenHash: string, userId: string, expiresAt: Date) {
  db().prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash, userId, expiresAt.toISOString(), now());
}

export function findSessionUser(tokenHash: string): UserRow | undefined {
  return db().prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).get(tokenHash, now()) as UserRow | undefined;
}

export function deleteSession(tokenHash: string) {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function purgeExpiredSessions() {
  db().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now());
}

// ---------- projects ----------
type ProjectRow = { id: string; user_id: string; name: string; scene_data: string; updated_at: string };
const toDto = (r: ProjectRow): ProjectDto => ({
  id: r.id, name: r.name, scene: JSON.parse(r.scene_data) as SceneData, updatedAt: r.updated_at,
});

/** 사용자의 가장 최근 프로젝트. 없으면 기본 방을 하나 만든다. */
export function getOrCreateLatestProject(userId: string, initial?: { name: string; scene: SceneData }): ProjectDto {
  const row = db().prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
    .get(userId) as ProjectRow | undefined;
  if (row) return toDto(row);
  return createProject(userId, initial?.name ?? "내 방", initial?.scene ?? DEFAULT_SCENE);
}

export function createProject(userId: string, name: string, scene: SceneData): ProjectDto {
  const t = now();
  const r: ProjectRow = { id: randomUUID(), user_id: userId, name, scene_data: JSON.stringify(scene), updated_at: t };
  db().prepare("INSERT INTO projects (id, user_id, name, scene_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(r.id, r.user_id, r.name, r.scene_data, t, t);
  return toDto(r);
}

/** 소유자가 맞을 때만 저장한다. 저장했으면 새 updatedAt, 아니면 null. */
export function saveProject(userId: string, projectId: string, name: string, scene: SceneData): string | null {
  const t = now();
  const res = db().prepare("UPDATE projects SET name = ?, scene_data = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(name, JSON.stringify(scene), t, projectId, userId);
  return Number(res.changes) > 0 ? t : null;
}
