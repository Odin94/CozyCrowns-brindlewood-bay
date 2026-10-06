import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[0.55rem] border border-transparent text-sm font-bold ring-offset-background shadow-[0_2px_0_hsl(var(--dark-secondary)_/_0.16),0_0.35rem_0.8rem_hsl(280_35%_12%_/_0.12)] transition-[transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-offset-0 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px hover:shadow-[0_3px_0_hsl(var(--dark-secondary)_/_0.16),0_0.55rem_1rem_hsl(280_35%_12%_/_0.16)] active:translate-y-0 active:scale-[0.97] active:shadow-[0_1px_0_hsl(var(--dark-secondary)_/_0.13)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-100 motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 motion-reduce:transition-opacity",
  {
    variants: {
      variant: {
        default:
          "border-primary/70 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/70 disabled:text-primary-foreground",
        dark: "border-dark-secondary bg-dark-secondary text-[hsl(var(--dark-foreground))] hover:bg-dark-secondary/85 disabled:bg-dark-secondary/70 disabled:text-[hsl(var(--dark-foreground))]",
        destructive:
          "border-destructive/80 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-destructive/65 disabled:text-destructive-foreground",
        outline:
          "border-border bg-card text-card-foreground hover:border-secondary hover:bg-secondary disabled:border-gray-600 disabled:text-gray-400",
        secondary:
          "border-secondary/70 bg-secondary text-secondary-foreground hover:bg-secondary/85 disabled:bg-secondary/70 disabled:text-secondary-foreground",
        ghost:
          "bg-secondary/35 text-secondary-foreground hover:bg-secondary/70 disabled:text-gray-400",
        bare: "bg-transparent text-inherit shadow-none hover:translate-y-0 hover:bg-transparent hover:shadow-none active:shadow-none",
        link: "border-0 bg-transparent text-dark-secondary shadow-none underline-offset-4 hover:text-foreground hover:underline hover:shadow-none active:shadow-none disabled:text-gray-400",
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
