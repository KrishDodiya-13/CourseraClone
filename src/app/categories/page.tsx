import type { Metadata } from "next";

import { Container, Grid, Section, Stack } from "@/components/layout/primitives";
import { PageHeader } from "@/components/layout/primitives";
import { CategoryCard } from "@/components/catalog/category-card";
import { EmptyState } from "@/components/states/empty-state";
import { getCategories } from "@/features/catalog/queries";

export const metadata: Metadata = {
  title: "Categories",
  description: "Every subject area on Coursera, with the number of published courses in each.",
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={8}>
          <PageHeader
            eyebrow="Browse"
            title="Categories"
            description="Every subject area on Coursera. Counts reflect published courses only."
          />

          {categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Categories appear here once courses are published."
            />
          ) : (
            <Grid cols={3} gap={5}>
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </Grid>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
