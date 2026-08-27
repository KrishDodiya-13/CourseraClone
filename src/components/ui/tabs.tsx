"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

type TabsVariant = "pill" | "underline";

const TabsVariantContext = React.createContext<TabsVariant>("pill");

function TabsList({
  className,
  variant = "pill",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        className={cn(
          "inline-flex items-center gap-1",
          variant === "pill" && "rounded-lg bg-muted p-1",
          variant === "underline" && "w-full gap-4 border-b border-border",
          className,
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext);

  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap",
        "transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        variant === "pill" && [
          "rounded-md px-3 py-1.5 text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs",
        ],
        variant === "underline" && [
          "-mb-px border-b-2 border-transparent px-1 pb-2.5 text-muted-foreground",
          "hover:border-border hover:text-foreground",
          "data-[state=active]:border-primary data-[state=active]:text-foreground",
        ],
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 data-[state=active]:animate-fade-in", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
