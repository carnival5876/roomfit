// 웹 데모(정적 단일 페이지) 진입점. Next.js 없이 같은 편집기를 렌더링한다.
import { createRoot } from "react-dom/client";
import Editor from "@/components/editor/Editor";

createRoot(document.getElementById("root")!).render(<Editor />);
