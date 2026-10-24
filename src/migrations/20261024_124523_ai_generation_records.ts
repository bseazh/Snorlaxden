import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ai_generations_provider" AS ENUM('deepseek', 'stepfun');
  CREATE TYPE "public"."enum_ai_generations_status" AS ENUM('running', 'succeeded', 'failed', 'saved_as_draft');
  CREATE TABLE "ai_generations" (
    "id" serial PRIMARY KEY NOT NULL,
    "creator_id" integer NOT NULL,
    "provider" "enum_ai_generations_provider" NOT NULL,
    "model" varchar NOT NULL,
    "prompt_version" varchar NOT NULL,
    "status" "enum_ai_generations_status" DEFAULT 'running' NOT NULL,
    "source_hash" varchar NOT NULL,
    "source_text" varchar NOT NULL,
    "verified_facts" varchar,
    "request" jsonb NOT NULL,
    "result" jsonb,
    "error_code" varchar,
    "error_message" varchar,
    "saved_post_id" integer,
    "markdown_path" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "posts" ADD COLUMN "ai_generation_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_ai_generation_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_generations_id" integer;
  ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_saved_post_id_posts_id_fk" FOREIGN KEY ("saved_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ai_generations_creator_idx" ON "ai_generations" USING btree ("creator_id");
  CREATE INDEX "ai_generations_status_idx" ON "ai_generations" USING btree ("status");
  CREATE INDEX "ai_generations_source_hash_idx" ON "ai_generations" USING btree ("source_hash");
  CREATE INDEX "ai_generations_saved_post_idx" ON "ai_generations" USING btree ("saved_post_id");
  CREATE INDEX "ai_generations_updated_at_idx" ON "ai_generations" USING btree ("updated_at");
  CREATE INDEX "ai_generations_created_at_idx" ON "ai_generations" USING btree ("created_at");
  ALTER TABLE "posts" ADD CONSTRAINT "posts_ai_generation_id_ai_generations_id_fk" FOREIGN KEY ("ai_generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_ai_generation_id_ai_generations_id_fk" FOREIGN KEY ("version_ai_generation_id") REFERENCES "public"."ai_generations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_generations_fk" FOREIGN KEY ("ai_generations_id") REFERENCES "public"."ai_generations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_ai_generation_idx" ON "posts" USING btree ("ai_generation_id");
  CREATE INDEX "_posts_v_version_version_ai_generation_idx" ON "_posts_v" USING btree ("version_ai_generation_id");
  CREATE INDEX "payload_locked_documents_rels_ai_generations_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_generations_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP CONSTRAINT "posts_ai_generation_id_ai_generations_id_fk";

  ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_ai_generation_id_ai_generations_id_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_generations_fk";

  DROP INDEX "posts_ai_generation_idx";
  DROP INDEX "_posts_v_version_version_ai_generation_idx";
  DROP INDEX "payload_locked_documents_rels_ai_generations_id_idx";
  ALTER TABLE "posts" DROP COLUMN "ai_generation_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_ai_generation_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_generations_id";
  ALTER TABLE "ai_generations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ai_generations";
  DROP TYPE "public"."enum_ai_generations_provider";
  DROP TYPE "public"."enum_ai_generations_status";`)
}
