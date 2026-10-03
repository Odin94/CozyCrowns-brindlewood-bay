import * as React from "react";

import { cn } from "@/lib/utils";

export type LineInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const LineInput = React.forwardRef<HTMLInputElement, LineInputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "cozy-field cozy-line-field flex w-full border-0 border-b border-border rounded-none px-2 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none no-ring",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
LineInput.displayName = "LineInput";

export { LineInput };
