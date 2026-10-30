-- Hashtags on posts: the column, an index for "posts with #tag", and the tags of the posts written so far (the same
-- rule as src/lib/hashtags.ts). Safe to run again.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX IF NOT EXISTS "posts_hashtags_idx" ON "posts" USING GIN ("hashtags");

UPDATE "posts" p SET "hashtags" = t.tags
FROM (
  SELECT id, ARRAY(
    SELECT tag FROM (
      SELECT lower(m[2]) AS tag, min(n) AS first
      FROM regexp_matches(content, '(^|[^[:alnum:]_&/])#([[:alnum:]_]+)', 'g') WITH ORDINALITY AS r(m, n)
      WHERE length(m[2]) <= 50
      GROUP BY lower(m[2])
    ) x ORDER BY first LIMIT 30
  ) AS tags
  FROM "posts" WHERE content LIKE '%#%'
) t
WHERE p.id = t.id AND p."hashtags" = ARRAY[]::TEXT[];
