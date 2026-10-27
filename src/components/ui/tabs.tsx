"use client"

import * as React from "react"
import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

// One look for every tab switcher, Plane-style: a recessed track with the current tab raised on it.
// Tabs/TabsList/TabsTrigger switch panels on the page; TabsNav/TabLink switch pages by URL.

const tabsListVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5 text-xs text-muted-foreground",
  {
    variants: {
      size: {
        default: "h-8",
        sm: "h-7",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const tabClass =
  "inline-flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2.5 font-medium whitespace-nowrap transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"
const activeClass = "bg-card text-foreground shadow-sm"

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-2", className)} {...props} />
}

function TabsList({
  className,
  size,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn(tabsListVariants({ size }), className)} {...props} />
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      // Radix marks the current tab with data-state="active".
      className={cn(tabClass, "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("text-sm outline-none", className)} {...props} />
}

/** The same track for tabs that are links: each TabLink is a page, the current one marked `active`. */
function TabsNav({ className, size, ...props }: React.ComponentProps<"nav"> & VariantProps<typeof tabsListVariants>) {
  return <nav data-slot="tabs-nav" className={cn(tabsListVariants({ size }), className)} {...props} />
}

function TabLink({ active, className, ...props }: React.ComponentProps<typeof Link> & { active: boolean }) {
  return (
    <Link
      data-slot="tab-link"
      aria-current={active ? "page" : undefined}
      className={cn(tabClass, active && activeClass, className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsNav, TabLink, tabsListVariants }
