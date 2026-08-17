CREATE TYPE "GitProviderType" AS ENUM ('GITHUB', 'GITLAB');
CREATE TYPE "GitConnectionAuthType" AS ENUM ('GITHUB_APP', 'OAUTH2');
CREATE TYPE "GitConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

CREATE TABLE "git_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "GitProviderType" NOT NULL,
    "base_url" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "provider_username" TEXT NOT NULL,
    "auth_type" "GitConnectionAuthType" NOT NULL,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "installation_id" TEXT,
    "status" "GitConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "git_connections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "git_connections_user_id_idx" ON "git_connections"("user_id");
CREATE UNIQUE INDEX "git_connections_user_id_provider_base_url_provider_user_id_key"
ON "git_connections"("user_id", "provider", "base_url", "provider_user_id");

ALTER TABLE "git_connections"
ADD CONSTRAINT "git_connections_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
