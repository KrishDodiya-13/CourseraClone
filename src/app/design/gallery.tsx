"use client";

import * as React from "react";
import { BookOpen, Check, Copy, Download, Ellipsis, Search, Settings2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/avatar";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Grid, Inline, Stack } from "@/components/layout/primitives";

/* -------------------------------------------------------------------------- */
/*  Gallery scaffolding                                                       */
/* -------------------------------------------------------------------------- */

function Spec({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">{children}</div>
      <Separator />
    </section>
  );
}

const swatches = [
  { name: "primary", className: "bg-primary" },
  { name: "accent", className: "bg-accent" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "danger", className: "bg-danger" },
  { name: "info", className: "bg-info" },
  { name: "muted", className: "bg-muted" },
  { name: "border", className: "bg-border" },
] as const;

const typeScale = [
  { label: "6xl / display", className: "font-display text-6xl font-semibold" },
  { label: "4xl / display", className: "font-display text-4xl font-semibold" },
  { label: "2xl / display", className: "font-display text-2xl font-semibold" },
  { label: "lg / sans", className: "text-lg" },
  { label: "base / sans", className: "text-base" },
  { label: "sm / sans", className: "text-sm" },
  { label: "2xs / mono", className: "font-mono text-2xs tracking-wide uppercase" },
] as const;

/* -------------------------------------------------------------------------- */

function Gallery() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function handleSave() {
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setModalOpen(false);
      toast.success("Changes saved", { description: "Your course draft has been updated." });
    }, 900);
  }

  return (
    <Stack gap={10}>
      {/* --- foundations ------------------------------------------------ */}
      <Spec title="Colour" hint="Deep pine primary, warm apricot accent, green-biased neutrals.">
        <Grid cols={4} gap={4}>
          {swatches.map((swatch) => (
            <div key={swatch.name} className="flex flex-col gap-2">
              <div className={`h-14 rounded-lg border border-border/50 ${swatch.className}`} />
              <span className="font-mono text-2xs text-muted-foreground">{swatch.name}</span>
            </div>
          ))}
        </Grid>
      </Spec>

      <Spec
        title="Typography"
        hint="Bricolage Grotesque for display, Plus Jakarta Sans for UI, JetBrains Mono for data."
      >
        <Stack gap={4}>
          {typeScale.map((step) => (
            <div key={step.label} className="flex flex-col gap-1">
              <span className="font-mono text-2xs text-muted-foreground">{step.label}</span>
              <span className={step.className}>Learn something that sticks</span>
            </div>
          ))}
        </Stack>
      </Spec>

      {/* --- buttons ---------------------------------------------------- */}
      <Spec title="Button" hint="Seven variants, five sizes, loading and icon-only forms.">
        <Stack gap={5}>
          <Inline gap={2}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link</Button>
          </Inline>
          <Inline gap={2}>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="outline" aria-label="Settings">
              <Settings2 aria-hidden="true" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Copy">
              <Copy aria-hidden="true" />
            </Button>
          </Inline>
          <Inline gap={2}>
            <Button isLoading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button variant="outline">
              <Download aria-hidden="true" />
              With icon
            </Button>
          </Inline>
        </Stack>
      </Spec>

      {/* --- form controls ---------------------------------------------- */}
      <Spec
        title="Form controls"
        hint="Field wires label, hint, error and aria-describedby together automatically."
      >
        <Grid cols={2} gap={6}>
          <Stack gap={5}>
            <Field>
              <FieldLabel>Course title</FieldLabel>
              <Input placeholder="Systems Design Foundations" />
              <FieldDescription>Shown on the course card and detail page.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Search</FieldLabel>
              <Input placeholder="Search courses" startIcon={<Search />} />
            </Field>

            <Field error="Enter a price of at least 0.">
              <FieldLabel>Price</FieldLabel>
              <Input type="number" defaultValue={-5} />
            </Field>
          </Stack>

          <Stack gap={5}>
            <Field>
              <FieldLabel>Difficulty</FieldLabel>
              <Select defaultValue="intermediate">
                <SelectTrigger>
                  <SelectValue placeholder="Choose a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Summary</FieldLabel>
              <Textarea placeholder="What will someone be able to do after this course?" />
              <FieldDescription>Two or three sentences works best.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Disabled</FieldLabel>
              <Input disabled defaultValue="Not editable" />
            </Field>
          </Stack>
        </Grid>
      </Spec>

      {/* --- badges + avatars ------------------------------------------- */}
      <Spec title="Badge &amp; Avatar">
        <Stack gap={5}>
          <Inline gap={2}>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="primary">Enrolled</Badge>
            <Badge variant="accent">Bestseller</Badge>
            <Badge variant="success">
              <Check aria-hidden="true" />
              Published
            </Badge>
            <Badge variant="warning">In review</Badge>
            <Badge variant="danger">Rejected</Badge>
            <Badge variant="info">Draft</Badge>
            <Badge variant="outline">Archived</Badge>
          </Inline>
          <Inline gap={3}>
            <UserAvatar name="Priya Raghunathan" size="xs" />
            <UserAvatar name="Daniel Okonkwo" size="sm" />
            <UserAvatar name="Mei Tanaka" size="md" />
            <UserAvatar name="Aria Nwosu" size="lg" />
            <UserAvatar name="Tomas Lindqvist" size="xl" />
          </Inline>
        </Stack>
      </Spec>

      {/* --- overlays --------------------------------------------------- */}
      <Spec title="Overlays" hint="Dialog, Modal, Dropdown, Tooltip and Toast.">
        <Inline gap={2}>
          <Modal
            open={modalOpen}
            onOpenChange={setModalOpen}
            trigger={<Button variant="outline">Open modal</Button>}
            title="Publish this course?"
            description="Students will be able to find and enrol in it immediately."
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} isLoading={saving}>
                  Publish
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted-foreground">
              You can unpublish at any time. Enrolled students keep their access.
            </p>
          </Modal>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Ellipsis aria-hidden="true" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Course</DropdownMenuLabel>
              <DropdownMenuItem>
                <BookOpen aria-hidden="true" />
                Preview
                <DropdownMenuShortcut>P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="danger">
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip content="Supplementary detail only — never put required information here.">
            <Button variant="ghost">Hover me</Button>
          </Tooltip>

          <Button variant="subtle" onClick={() => toast.success("Lesson marked complete")}>
            Success toast
          </Button>
          <Button
            variant="subtle"
            onClick={() =>
              toast.error("Upload failed", {
                description: "The file is larger than the 50 MB limit. Try compressing it.",
              })
            }
          >
            Error toast
          </Button>
        </Inline>
      </Spec>

      {/* --- tabs ------------------------------------------------------- */}
      <Spec title="Tabs" hint="Pill for switching panels; underline for page-level sections.">
        <Stack gap={6}>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="text-sm text-muted-foreground">
                Pill variant — best inside a card or panel.
              </p>
            </TabsContent>
            <TabsContent value="curriculum">
              <p className="text-sm text-muted-foreground">Sections and lessons go here.</p>
            </TabsContent>
            <TabsContent value="reviews">
              <p className="text-sm text-muted-foreground">Student reviews go here.</p>
            </TabsContent>
          </Tabs>

          <Tabs defaultValue="students">
            <TabsList variant="underline">
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="students">
              <p className="text-sm text-muted-foreground">
                Underline variant — best directly beneath a page header.
              </p>
            </TabsContent>
            <TabsContent value="revenue">
              <p className="text-sm text-muted-foreground">Revenue analytics arrive in Phase 11.</p>
            </TabsContent>
            <TabsContent value="settings">
              <p className="text-sm text-muted-foreground">Course settings go here.</p>
            </TabsContent>
          </Tabs>
        </Stack>
      </Spec>

      {/* --- cards ------------------------------------------------------ */}
      <Spec title="Card" hint="Three surfaces, plus an interactive form for clickable cards.">
        <Grid cols={3} gap={5}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outline</CardTitle>
              <CardDescription>Default surface for most content.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button size="sm" variant="outline">
                Action
              </Button>
            </CardFooter>
          </Card>
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-base">Elevated</CardTitle>
              <CardDescription>Raised above the page.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
          <Card variant="muted" interactive>
            <CardHeader>
              <CardTitle className="text-base">Muted + interactive</CardTitle>
              <CardDescription>Lifts on hover. Wrap in a link.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Badge variant="primary" size="sm">
                Hover me
              </Badge>
            </CardFooter>
          </Card>
        </Grid>
      </Spec>

      {/* --- states ----------------------------------------------------- */}
      <Spec
        title="States"
        hint="Empty, error, loading and skeleton — all built on one shared shell."
      >
        <Grid cols={2} gap={5}>
          <Card variant="muted">
            <CardContent className="p-0">
              <EmptyState
                bordered={false}
                icon={<BookOpen aria-hidden="true" />}
                title="No courses yet"
                description="Courses you enrol in will appear here."
                actions={<Button size="sm">Browse catalogue</Button>}
              />
            </CardContent>
          </Card>
          <Card variant="muted">
            <CardContent className="p-0">
              <ErrorState
                bordered={false}
                onRetry={() => toast("Retrying")}
                description="We could not load your courses. Try again in a moment."
              />
            </CardContent>
          </Card>
          <Card variant="muted">
            <CardContent className="p-0">
              <LoadingState label="Loading your courses" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Inline gap={3} wrap={false}>
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-2 h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </Inline>
            </CardHeader>
            <CardContent>
              <SkeletonText lines={3} />
            </CardContent>
          </Card>
        </Grid>
      </Spec>
    </Stack>
  );
}

export { Gallery };
