CREATE TABLE "repositories" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repositories_connection_id_external_id_key"
ON "repositories"("connection_id", "external_id");
CREATE INDEX "repositories_connection_id_idx" ON "repositories"("connection_id");
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_connection_id_fkey"
FOREIGN KEY ("connection_id") REFERENCES "git_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
