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
          "relative animate-in fade-in-0 zoom-in-95 before:pointer-events-none before:absolute before:size-3 before:rotate-45 before:border-t before:border-l before:border-dark-secondary/35 before:bg-[#fffaf0] before:content-[''] data-[side=bottom]:before:-top-1.5 data-[side=bottom]:before:left-4 data-[side=left]:before:-right-1.5 data-[side=left]:before:top-4 data-[side=right]:before:-left-1.5 data-[side=right]:before:top-4 data-[side=top]:before:-bottom-1.5 data-[side=top]:before:left-4 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-60 max-w-[calc(100vw-2rem)] origin-(--radix-tooltip-content-transform-origin) rounded-sm border border-dark-secondary/35 bg-[#fffaf0] px-3 py-2 text-left text-xs leading-snug text-dark-secondary shadow-[3px_3px_0_hsl(280_30%_25%_/_0.22)]",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

type PressTooltipProps = {
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  content: React.ReactNode;
  title?: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  align?: React.ComponentProps<typeof TooltipContent>["align"];
};

/**
 * A tooltip that opens instantly on hover or focus and during a touch long-press.
 * Releasing a long-press closes it immediately and prevents the accompanying click.
 */
function PressTooltip({
  children,
  content,
  title,
  side = "top",
  align = "center",
}: PressTooltipProps) {
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
      <TooltipContent side={side} align={align}>
        {title && (
          <span className="mb-1 block text-[0.65rem] font-extrabold tracking-[0.16em] text-dark-secondary uppercase">
            {title}
          </span>
        )}
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, PressTooltip };
