import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-semibold ring-offset-background shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-md active:scale-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-100",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/70",
        dark: "bg-dark-secondary text-dark-foreground hover:bg-dark-secondary/85 disabled:bg-dark-secondary/70",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-destructive/65",
        outline:
          "border-border bg-card text-card-foreground hover:border-secondary hover:bg-secondary disabled:border-gray-600 disabled:text-gray-400",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/85 disabled:bg-secondary/70",
        ghost:
          "bg-secondary/35 text-secondary-foreground hover:bg-secondary/70 disabled:text-gray-400",
        bare: "bg-transparent text-inherit shadow-none hover:bg-transparent hover:shadow-none",
        link:
          "bg-transparent text-dark-secondary underline-offset-4 hover:text-foreground hover:underline disabled:text-gray-400",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        bare: "h-auto px-0 py-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
