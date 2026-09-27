// ============================================================================
// SECTION 1: IMPORTS & CLASSNAMES HELPER
// ============================================================================
import * as React from "react"

import { cn } from "@/lib/utils"

// ============================================================================
// SECTION 2: ROOT CARD CONTAINER COMPONENT
// ============================================================================
// Main Card wrapper with background, border, shadow, and flex column layout
function Card({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props} />
  );
}

// ============================================================================
// SECTION 3: CARD HEADER & TITLES
// ============================================================================
// Header container for card title, action, and description
function CardHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props} />
  );
}

// Title typography component
function CardTitle({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props} />
  );
}

// Description subtitle typography
function CardDescription({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props} />
  );
}

// ============================================================================
// SECTION 4: CARD CONTENT & ACTION ELEMENTS
// ============================================================================
// Header action slot for right-aligned buttons or badges
function CardAction({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props} />
  );
}

// Main body container for card content
function CardContent({
  className,
  ...props
}) {
  return (<div data-slot="card-content" className={cn("px-6", className)} {...props} />);
}

// ============================================================================
// SECTION 5: CARD FOOTER
// ============================================================================
// Bottom container for actions or auxiliary information
function CardFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props} />
  );
}

// ============================================================================
// SECTION 6: MODULE EXPORTS
// ============================================================================
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
