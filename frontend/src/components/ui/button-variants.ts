import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-semibold ring-offset-background shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 enabled:cursor-pointer enabled:active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-100",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground enabled:hover:bg-primary/90 enabled:hover:shadow-md disabled:bg-primary/70 disabled:text-primary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground enabled:hover:bg-destructive/90 enabled:hover:shadow-md disabled:bg-destructive/65 disabled:text-destructive-foreground/80",
        outline:
          "border-secondary/75 bg-transparent text-tertiary enabled:hover:border-secondary enabled:hover:bg-secondary/15 disabled:border-gray-600 disabled:text-gray-400",
        secondary:
          "bg-secondary text-secondary-foreground enabled:hover:bg-secondary/85 enabled:hover:shadow-md disabled:bg-secondary/70 disabled:text-secondary-foreground",
        ghost:
          "bg-transparent text-secondary enabled:hover:bg-secondary/15 enabled:hover:text-tertiary disabled:text-gray-400",
        link:
          "bg-transparent text-secondary underline-offset-4 enabled:hover:text-tertiary enabled:hover:underline disabled:text-gray-400",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
