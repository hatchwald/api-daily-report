CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "total_commits" INTEGER NOT NULL DEFAULT 0,
    "total_merge_requests" INTEGER NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_items" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "repository_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "activity_count" INTEGER NOT NULL,
    "source_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "report_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reports_user_id_report_date_key" ON "reports"("user_id", "report_date");
CREATE INDEX "reports_user_id_idx" ON "reports"("user_id");
CREATE INDEX "report_items_report_id_idx" ON "report_items"("report_id");
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_items" ADD CONSTRAINT "report_items_report_id_fkey"
FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
