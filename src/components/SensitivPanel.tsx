import type { ReactNode } from "react";

interface SensitivPanelProps {
  background?: boolean;
  children: ReactNode;
}

export const SensitivPanel = ({ background = true, children }: SensitivPanelProps) => (
  <div
    className="p-4 pl-6"
    style={{
      backgroundColor: background ? "var(--ax-bg-danger-soft)" : undefined,
      borderLeft: "4px solid var(--ax-bg-danger-soft)",
    }}
  >
    {children}
  </div>
);
