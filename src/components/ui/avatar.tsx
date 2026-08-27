"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full bg-muted select-none",
  {
    variants: {
      size: {
        xs: "size-6 text-2xs",
        sm: "size-8 text-xs",
        md: "size-10 text-sm",
        lg: "size-14 text-lg",
        xl: "size-20 text-2xl",
      },
    },
    defaultVariants: { size: "md" },
  },
);

function Avatar({
  className,
  size,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & VariantProps<typeof avatarVariants>) {
  return <AvatarPrimitive.Root className={cn(avatarVariants({ size }), className)} {...props} />;
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full",
        "bg-primary-subtle font-medium text-primary-subtle-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Reduce a display name to at most two initials for the fallback. */
function initialsFrom(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export interface UserAvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string | null;
  className?: string;
}

/**
 * The composed avatar used throughout the app: image when available, initials
 * otherwise, and always an accessible name.
 */
function UserAvatar({ name, src, size, className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback aria-label={name}>{initialsFrom(name)}</AvatarFallback>
    </Avatar>
  );
}

export { Avatar, AvatarImage, AvatarFallback, UserAvatar, initialsFrom };
