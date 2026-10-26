export type SaveState = "saved" | "dirty" | "saving" | "error";

/** 로그인한 사용자 정보와 저장 상태. 데스크톱·휴대폰 화면이 함께 쓴다. */
export type AccountInfo = {
  userName: string;
  email: string;
  save: SaveState;
  errorMsg: string | null;
  onLogout: () => void;
};

export const saveLabel = (s: SaveState) =>
  s === "saved" ? "저장됨" : s === "saving" ? "저장 중…" : s === "dirty" ? "변경됨" : "저장 실패";

export const saveDot = (s: SaveState) =>
  s === "saved" ? "bg-emerald-500" : s === "error" ? "bg-red-500" : "bg-amber-400";
