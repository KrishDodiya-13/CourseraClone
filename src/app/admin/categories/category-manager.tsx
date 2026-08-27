"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { CategoryIcon } from "@/components/catalog/category-icon";
import type { CategoryIconKey } from "@/features/catalog/types";
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from "@/features/admin/actions";
import type { AdminCategoryRow } from "@/features/admin/categories";

const ICON_KEYS: CategoryIconKey[] = [
  "code",
  "chart",
  "brain",
  "palette",
  "briefcase",
  "megaphone",
  "shield",
  "camera",
];

/** Mirrors the server's slug rule, so the field cannot produce a rejected value. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface Draft {
  id?: string;
  name: string;
  slug: string;
  description: string;
  iconKey: CategoryIconKey;
  /** True once the slug has been typed in directly and should stop tracking. */
  slugTouched: boolean;
}

const EMPTY: Draft = {
  name: "",
  slug: "",
  description: "",
  iconKey: "code",
  slugTouched: false,
};

/**
 * Category management.
 *
 * Ordering uses buttons rather than drag-and-drop. A keyboard user can reorder
 * with the same two controls everyone else uses, and the result is one explicit
 * save rather than a stream of positions written on every pointer move.
 *
 * The list is reordered optimistically so the arrows feel instant, but the
 * order is only *saved* when the admin says so — and the save sends the whole
 * ordered list, so it lands the same way whatever else happened in between.
 */
function CategoryManager({ categories }: { categories: AdminCategoryRow[] }) {
  const [pending, startTransition] = React.useTransition();
  const [order, setOrder] = React.useState(categories);
  const [dirty, setDirty] = React.useState(false);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [deleting, setDeleting] = React.useState<AdminCategoryRow | null>(null);

  // A server refresh after any mutation replaces the list; the local order is
  // dropped with it, because the server's is now the truth.
  React.useEffect(() => {
    setOrder(categories);
    setDirty(false);
  }, [categories]);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;

    const next = [...order];
    const moved = next[index];
    const displaced = next[target];
    if (!moved || !displaced) return;

    next[index] = displaced;
    next[target] = moved;
    setOrder(next);
    setDirty(true);
  }

  function saveOrder() {
    startTransition(async () => {
      const result = await reorderCategoriesAction({ orderedIds: order.map((row) => row.id) });
      if (result.ok) {
        toast.success(result.message ?? "Order saved");
        setDirty(false);
      } else {
        toast.error(result.message ?? "That did not work");
      }
    });
  }

  function submitDraft() {
    if (!editing) return;
    const draft = editing;

    startTransition(async () => {
      const payload = {
        name: draft.name.trim(),
        slug: slugify(draft.slug || draft.name),
        description: draft.description.trim(),
        iconKey: draft.iconKey,
      };

      const result = draft.id
        ? await updateCategoryAction({ id: draft.id, ...payload })
        : await createCategoryAction(payload);

      if (result.ok) {
        toast.success(result.message ?? "Saved");
        setEditing(null);
      } else {
        toast.error(result.message ?? "That did not work");
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;

    startTransition(async () => {
      const result = await deleteCategoryAction({ id: target.id });
      if (result.ok) {
        toast.success(result.message ?? "Deleted");
        setDeleting(null);
      } else {
        // The category is kept open so the message stays next to what it is
        // about — usually "move the courses first".
        toast.error(result.message ?? "That did not work");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Order here is the order learners see in the navigation and on the categories page.
        </p>
        <div className="flex gap-2">
          {dirty ? (
            <Button size="sm" onClick={saveOrder} isLoading={pending} loadingText="Saving">
              Save order
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setEditing({ ...EMPTY })}>
            <Plus aria-hidden="true" />
            New category
          </Button>
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {order.map((category, index) => (
          <li key={category.id}>
            <Card
              className={cn("flex flex-wrap items-center gap-3 p-4", dirty && "border-primary/30")}
            >
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${category.name} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${category.name} down`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary-subtle-foreground">
                <CategoryIcon iconKey={category.iconKey as CategoryIconKey} className="size-5" />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{category.name}</span>
                  <code className="font-mono text-2xs text-muted-foreground">{category.slug}</code>
                  {category.parentName ? (
                    <Badge variant="neutral" size="sm">
                      under {category.parentName}
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-sm text-muted-foreground">{category.description}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  <span data-numeric>{category.publishedCourseCount}</span> published
                  {category.totalCourseCount !== category.publishedCourseCount ? (
                    <>
                      {" · "}
                      <span data-numeric>{category.totalCourseCount}</span> total
                    </>
                  ) : null}
                </span>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${category.name}`}
                  onClick={() =>
                    setEditing({
                      id: category.id,
                      name: category.name,
                      slug: category.slug,
                      description: category.description,
                      iconKey: category.iconKey as CategoryIconKey,
                      slugTouched: true,
                    })
                  }
                >
                  <Pencil aria-hidden="true" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => setDeleting(category)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {/* --- create / edit -------------------------------------------------- */}
      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.id ? `Edit ${editing.name}` : "New category"}
        description="The slug appears in catalogue URLs, so changing it on an existing category will break old links."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitDraft}
              isLoading={pending}
              loadingText="Saving"
              disabled={!editing || editing.name.trim().length < 2}
            >
              {editing?.id ? "Save changes" : "Create category"}
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input
                value={editing.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setEditing((current) =>
                    current
                      ? {
                          ...current,
                          name,
                          // The slug follows the name until it is edited by
                          // hand, then it stops moving under the admin.
                          slug: current.slugTouched ? current.slug : slugify(name),
                        }
                      : current,
                  );
                }}
                placeholder="Data science"
                maxLength={60}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Slug</span>
              <Input
                value={editing.slug}
                onChange={(event) =>
                  setEditing((current) =>
                    current
                      ? { ...current, slug: slugify(event.target.value), slugTouched: true }
                      : current,
                  )
                }
                placeholder="data-science"
                className="font-mono"
                maxLength={60}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Description</span>
              <Textarea
                value={editing.description}
                onChange={(event) =>
                  setEditing((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
                placeholder="What someone will find in this category."
                rows={3}
                maxLength={300}
              />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Icon</legend>
              <div className="flex flex-wrap gap-2">
                {ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    aria-pressed={editing.iconKey === key}
                    onClick={() =>
                      setEditing((current) => (current ? { ...current, iconKey: key } : current))
                    }
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg border transition-colors",
                      editing.iconKey === key
                        ? "border-primary bg-primary-subtle text-primary-subtle-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30",
                    )}
                  >
                    <CategoryIcon iconKey={key} className="size-5" />
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}
      </Modal>

      {/* --- delete --------------------------------------------------------- */}
      <Modal
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "category"}?`}
        description={
          deleting && deleting.totalCourseCount > 0
            ? `This category still holds ${deleting.totalCourseCount} course${
                deleting.totalCourseCount === 1 ? "" : "s"
              }. Move them to another category first.`
            : deleting && deleting.childCount > 0
              ? "This category still has sub-categories. Remove those first."
              : "This cannot be undone. The deletion is recorded in the audit log."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              isLoading={pending}
              loadingText="Deleting"
              disabled={Boolean(
                deleting && (deleting.totalCourseCount > 0 || deleting.childCount > 0),
              )}
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}

export { CategoryManager };
