import type { Metadata } from "next";
import App from "@/components/App";
import { APP_NAME } from "@/components/brand";

export const metadata: Metadata = { title: `${APP_NAME} · App` };

export default function AppPage() {
  return <App />;
}
