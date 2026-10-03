import { useRef, useState, type ReactNode } from "react";
import { t } from "@lingui/core/macro";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type Action = { label: string; run: () => void; destructive?: boolean };

/** Keep the visible row intact; Radix owns menu focus, collision and dismissal. */
export function ContextActions({ children, actions }: { children: ReactNode; actions: Action[] }) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const show = (target: HTMLElement, container: HTMLElement, x: number, y: number) => {
    returnFocus.current =
      target.closest<HTMLElement>("button, a, [tabindex]") ??
      container.querySelector<HTMLElement>(
        'button:not([aria-hidden="true"]), a[href], [tabindex="0"]',
      ) ??
      target;
    setPosition({ x, y });
  };
  return (
    <div
      className="contents"
      onContextMenu={(event) => {
        if (event.shiftKey) return;
        event.preventDefault();
        show(event.target as HTMLElement, event.currentTarget, event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
        event.preventDefault();
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        show(target, event.currentTarget, rect.left, rect.bottom);
      }}
    >
      {children}
      <DropdownMenu
        open={position !== null}
        onOpenChange={(open) => {
          if (!open) setPosition(null);
        }}
      >
        <DropdownMenuTrigger
          aria-label={t`Actions`}
          aria-hidden
          tabIndex={-1}
          style={{
            position: "fixed",
            left: position?.x ?? 0,
            top: position?.y ?? 0,
            width: 0,
            height: 0,
            padding: 0,
            border: 0,
            pointerEvents: "none",
          }}
        />
        <DropdownMenuContent
          align="start"
          sideOffset={2}
          collisionPadding={8}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              variant={action.destructive ? "destructive" : "default"}
              onSelect={action.run}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
