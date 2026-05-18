import type { ReactNode } from "react";
import { Button } from "../../components/Button";

type FirstRunButtonProps = {
  children: ReactNode;
  color?: "outline" | "primary";
  disabled?: boolean;
  onClick: () => void;
};

export function FirstRunButton({ children, color = "primary", disabled = false, onClick }: FirstRunButtonProps) {
  return (
    <Button color={color} disabled={disabled} onClick={onClick} size="large">
      {children}
    </Button>
  );
}
