import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { ThemeControl } from "../components/theme-control";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-identity">
          <a className="product-mark" href="/workspace">
            Cartograph
          </a>
          <OrganizationSwitcher
            afterCreateOrganizationUrl="/workspace"
            afterSelectOrganizationUrl="/workspace"
            hidePersonal
          />
        </div>
        <div className="app-header-actions">
          <ThemeControl />
          <UserButton />
        </div>
      </header>
      {children}
    </div>
  );
}
