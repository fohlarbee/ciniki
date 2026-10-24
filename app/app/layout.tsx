import Providers from "@/components/Providers";
import "@/styles/app.css";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
