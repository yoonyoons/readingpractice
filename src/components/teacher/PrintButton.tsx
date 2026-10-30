"use client";

import { Button } from "@/components/ui";

export function PrintButton({ label = "인쇄·PDF로 저장" }: { label?: string }) {
  return (
    <Button variant="primary" size="md" onClick={() => window.print()}>
      🖨️ {label}
    </Button>
  );
}
