// 앱(Capacitor) 진입점. 웹과 같은 화면 코드를 쓴다.
import { createRoot } from "react-dom/client";
import EditorClient from "@/components/editor/EditorClient";
import { setupNative } from "./native";

setupNative();
createRoot(document.getElementById("root")!).render(<EditorClient />);
