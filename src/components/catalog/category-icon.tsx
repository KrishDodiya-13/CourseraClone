import {
  Brain,
  Briefcase,
  Camera,
  ChartNoAxesCombined,
  Code2,
  Megaphone,
  Palette,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import type { CategoryIconKey } from "@/features/catalog/types";

/**
 * Maps the icon key stored on a Category row to a component.
 *
 * The database stores the key, never a component or a class name, so adding a
 * category is a data change and the set of allowed icons stays type-checked.
 */
const categoryIcons: Record<CategoryIconKey, LucideIcon> = {
  code: Code2,
  chart: ChartNoAxesCombined,
  brain: Brain,
  palette: Palette,
  briefcase: Briefcase,
  megaphone: Megaphone,
  shield: ShieldCheck,
  camera: Camera,
};

function CategoryIcon({ iconKey, className }: { iconKey: CategoryIconKey; className?: string }) {
  const Icon = categoryIcons[iconKey];
  return <Icon className={className} aria-hidden="true" />;
}

export { CategoryIcon, categoryIcons };
