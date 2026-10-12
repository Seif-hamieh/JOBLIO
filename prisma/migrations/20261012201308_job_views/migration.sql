-- CreateTable
CREATE TABLE "job_views" (
    "jobId" TEXT NOT NULL,
    "viewerKey" VARCHAR(64) NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_views_pkey" PRIMARY KEY ("jobId","viewerKey")
);

-- CreateIndex
CREATE INDEX "job_views_viewedAt_idx" ON "job_views"("viewedAt");

-- AddForeignKey
ALTER TABLE "job_views" ADD CONSTRAINT "job_views_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
