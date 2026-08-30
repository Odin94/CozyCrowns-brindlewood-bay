import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit max-w-[min(20rem,calc(100vw-2rem))] origin-(--radix-tooltip-content-transform-origin) rounded-xl border border-secondary/70 bg-[radial-gradient(circle_at_top,hsl(var(--primary))_0%,hsl(180_25%_78%)_100%)] px-4 py-3 text-xs leading-relaxed text-dark-secondary shadow-[0_0.8rem_2.4rem_hsl(280_35%_10%_/_0.35)]",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-primary z-50 size-3" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

type PressTooltipProps = {
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  content: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
};

/**
 * A tooltip that opens instantly on hover or focus and during a touch long-press.
 * Releasing a long-press closes it immediately and prevents the accompanying click.
 */
function PressTooltip({ children, content, side = "top" }: PressTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const longPressTimer = React.useRef<number | null>(null);
  const didLongPress = React.useRef(false);
  const pressStart = React.useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  React.useEffect(() => clearLongPress, []);

  const child = React.Children.only(children);
  const trigger = React.cloneElement(child, {
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
      child.props.onPointerEnter?.(event);
      if (event.pointerType !== "touch") setOpen(true);
    },
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
      child.props.onPointerLeave?.(event);
      clearLongPress();
      pressStart.current = null;
      setOpen(false);
    },
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      child.props.onPointerDown?.(event);
      if (event.pointerType !== "touch") return;

      didLongPress.current = false;
      pressStart.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      longPressTimer.current = window.setTimeout(() => {
        didLongPress.current = true;
        setOpen(true);
      }, 350);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      child.props.onPointerMove?.(event);
      if (event.pointerType !== "touch" || !pressStart.current) return;

      const moved = Math.hypot(
        event.clientX - pressStart.current.x,
        event.clientY - pressStart.current.y,
      );
      if (moved > 10) {
        clearLongPress();
        pressStart.current = null;
        setOpen(false);
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      child.props.onPointerUp?.(event);
      clearLongPress();
      pressStart.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (didLongPress.current) setOpen(false);
    },
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
      child.props.onPointerCancel?.(event);
      clearLongPress();
      pressStart.current = null;
      setOpen(false);
    },
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
      child.props.onContextMenu?.(event);
      if (didLongPress.current) event.preventDefault();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      child.props.onFocus?.(event);
      setOpen(true);
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      child.props.onBlur?.(event);
      clearLongPress();
      setOpen(false);
    },
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (didLongPress.current) {
        event.preventDefault();
        event.stopPropagation();
        didLongPress.current = false;
        return;
      }
      child.props.onClick?.(event);
    },
  });

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, PressTooltip };
