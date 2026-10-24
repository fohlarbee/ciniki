import type { Metadata } from "next";
import App from "@/components/App";

export const metadata: Metadata = { title: `${process.env.NEXT_PUBLIC_APP_NAME || "Brine"} — App` };

export default function AppPage() {
  return <App />;
}
