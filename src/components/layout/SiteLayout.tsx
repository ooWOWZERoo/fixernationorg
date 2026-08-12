import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

interface SiteLayoutProps {
  children: React.ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
