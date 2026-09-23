import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../../lib/utils.js";
import { Spinner } from "./spinner.js";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default:
          "h-10 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-10",
        "icon-lg": "size-11",
        "icon-sm":
          "size-9 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-xs":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        input:
          "h-[var(--field-height)] gap-2 rounded-[var(--field-radius)] px-[var(--field-padding-x)] py-[var(--field-padding-y)]",
        "input-sm":
          "h-[var(--field-height-sm)] gap-2 rounded-[var(--field-radius)] px-[var(--field-padding-x)] py-[var(--field-padding-y)]",
        lg: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        sm: "h-9 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 aria-pressed:bg-primary/95",
        destructive:
          "text-destructive-foreground bg-destructive hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30 active:bg-destructive/80 aria-pressed:bg-destructive/80",
        destructiveSecondary:
          "border-red-200 text-red-700 hover:bg-red-50 active:bg-red-100 aria-pressed:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/60 dark:active:bg-red-950 dark:aria-pressed:bg-red-950",
        ghost:
          "hover:bg-muted hover:text-foreground active:bg-muted/80 aria-expanded:bg-muted aria-pressed:bg-muted/80 dark:hover:bg-muted/50 dark:active:bg-muted/60 dark:aria-pressed:bg-muted/60",
        input:
          "aria-invalid:border-destructive-foreground border-input bg-card font-sans text-base leading-snug font-normal text-foreground shadow-input hover:border-input-hover focus-visible:ring-2 focus-visible:ring-ring/15 focus-visible:ring-offset-1 focus-visible:ring-offset-background active:border-input-hover/80 aria-pressed:border-input-hover data-[placeholder]:text-placeholder-foreground",
        link: "text-primary underline-offset-4 hover:underline active:opacity-80 aria-pressed:underline aria-pressed:opacity-80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground active:bg-muted/80 aria-expanded:bg-muted aria-pressed:bg-muted/80 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 dark:active:bg-input/60 dark:aria-pressed:bg-input/60",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/85 active:bg-secondary/75 aria-expanded:bg-secondary aria-pressed:bg-secondary/75",
        success:
          "bg-success text-success-foreground hover:bg-success/90 focus-visible:border-success focus-visible:ring-success/30 active:bg-success/80 aria-pressed:bg-success/80",
        successSecondary:
          "border-green-200 text-green-700 hover:bg-green-50 active:bg-green-100 aria-pressed:bg-green-100 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/60 dark:active:bg-green-950 dark:aria-pressed:bg-green-950",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:border-warning focus-visible:ring-warning/30 active:bg-warning/80 aria-pressed:bg-warning/80",
        warningSecondary:
          "border-yellow-200 text-yellow-700 hover:bg-yellow-50 active:bg-yellow-100 aria-pressed:bg-yellow-100 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950/60 dark:active:bg-yellow-950 dark:aria-pressed:bg-yellow-950",
      },
    },
  }
);

const Button = ({
  className,
  variant = "default",
  size = "default",
  render,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    render?: React.ReactElement;
    loading?: boolean;
  }) => {
  const isDisabled = disabled || loading;
  const useCustomRender = render !== undefined && !loading;

  const renderedChildren = loading ? (
    <>
      <span aria-hidden="true" className="invisible opacity-0">
        {children}
      </span>
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <Spinner />
      </span>
    </>
  ) : (
    children
  );

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          buttonVariants({ className, size, variant }),
          loading && "cursor-wait"
        ),
      },
      useCustomRender
        ? props
        : {
            ...props,
            ...(loading && { "aria-busy": true }),
            children: renderedChildren,
            disabled: isDisabled,
          }
    ),
    render: useCustomRender ? render : undefined,
    state: {
      size,
      slot: "button",
      variant,
    },
  });
};

export { Button, buttonVariants };
