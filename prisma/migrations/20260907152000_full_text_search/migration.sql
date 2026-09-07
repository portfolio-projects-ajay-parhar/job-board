-- Full-text search support for "Job" (Prisma cannot model generated tsvector columns)

-- Weighted search vector: title (A) > description (B) > location (C)
ALTER TABLE "Job" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("location", '')), 'C')
) STORED;

CREATE INDEX "Job_searchVector_gin" ON "Job" USING GIN ("searchVector");

-- Partial-word / prefix matching on titles ("reac" should still hint "react")
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Job_title_trgm_gin" ON "Job" USING GIN ("title" gin_trgm_ops);
