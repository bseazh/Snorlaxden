import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ai_image_generations_provider" AS ENUM('sophnet');
  CREATE TYPE "public"."enum_ai_image_generations_status" AS ENUM('queued', 'running', 'partially_succeeded', 'succeeded', 'failed', 'cancelled', 'selected');
  CREATE TABLE "ai_image_generations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"creator_id" integer NOT NULL,
  	"post_id" integer NOT NULL,
  	"reference_material_id" integer NOT NULL,
  	"provider" "enum_ai_image_generations_provider" NOT NULL,
  	"model" varchar NOT NULL,
  	"prompt_version" varchar NOT NULL,
  	"status" "enum_ai_image_generations_status" DEFAULT 'queued' NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"prompt" varchar NOT NULL,
  	"request" jsonb NOT NULL,
  	"candidates" jsonb,
  	"requested_count" numeric DEFAULT 1 NOT NULL,
  	"generation_call_count" numeric DEFAULT 0 NOT NULL,
  	"retry_count" numeric DEFAULT 0 NOT NULL,
  	"usage" jsonb,
  	"error_code" varchar,
  	"error_message" varchar,
  	"selected_candidate_id" varchar,
  	"selected_media_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "media" ADD COLUMN "ai_generated" boolean DEFAULT false;
  ALTER TABLE "media" ADD COLUMN "source_image_generation_id" integer;
  ALTER TABLE "media" ADD COLUMN "ai_provider" varchar;
  ALTER TABLE "media" ADD COLUMN "ai_model" varchar;
  ALTER TABLE "media" ADD COLUMN "ai_prompt_version" varchar;
  ALTER TABLE "media" ADD COLUMN "sha256" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_image_generations_id" integer;
  ALTER TABLE "ai_image_generations" ADD CONSTRAINT "ai_image_generations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_image_generations" ADD CONSTRAINT "ai_image_generations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_image_generations" ADD CONSTRAINT "ai_image_generations_reference_material_id_source_materials_id_fk" FOREIGN KEY ("reference_material_id") REFERENCES "public"."source_materials"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_image_generations" ADD CONSTRAINT "ai_image_generations_selected_media_id_media_id_fk" FOREIGN KEY ("selected_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ai_image_generations_creator_idx" ON "ai_image_generations" USING btree ("creator_id");
  CREATE INDEX "ai_image_generations_post_idx" ON "ai_image_generations" USING btree ("post_id");
  CREATE INDEX "ai_image_generations_reference_material_idx" ON "ai_image_generations" USING btree ("reference_material_id");
  CREATE INDEX "ai_image_generations_status_idx" ON "ai_image_generations" USING btree ("status");
  CREATE UNIQUE INDEX "ai_image_generations_idempotency_key_idx" ON "ai_image_generations" USING btree ("idempotency_key");
  CREATE INDEX "ai_image_generations_selected_media_idx" ON "ai_image_generations" USING btree ("selected_media_id");
  CREATE INDEX "ai_image_generations_updated_at_idx" ON "ai_image_generations" USING btree ("updated_at");
  CREATE INDEX "ai_image_generations_created_at_idx" ON "ai_image_generations" USING btree ("created_at");
  ALTER TABLE "media" ADD CONSTRAINT "media_source_image_generation_id_ai_image_generations_id_fk" FOREIGN KEY ("source_image_generation_id") REFERENCES "public"."ai_image_generations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_image_generations_fk" FOREIGN KEY ("ai_image_generations_id") REFERENCES "public"."ai_image_generations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_source_image_generation_idx" ON "media" USING btree ("source_image_generation_id");
  CREATE INDEX "media_sha256_idx" ON "media" USING btree ("sha256");
  CREATE INDEX "payload_locked_documents_rels_ai_image_generations_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_image_generations_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_source_image_generation_id_ai_image_generations_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ai_image_generations_fk";
  ALTER TABLE "ai_image_generations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ai_image_generations" CASCADE;
  
  DROP INDEX "media_source_image_generation_idx";
  DROP INDEX "media_sha256_idx";
  DROP INDEX "payload_locked_documents_rels_ai_image_generations_id_idx";
  ALTER TABLE "media" DROP COLUMN "ai_generated";
  ALTER TABLE "media" DROP COLUMN "source_image_generation_id";
  ALTER TABLE "media" DROP COLUMN "ai_provider";
  ALTER TABLE "media" DROP COLUMN "ai_model";
  ALTER TABLE "media" DROP COLUMN "ai_prompt_version";
  ALTER TABLE "media" DROP COLUMN "sha256";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_image_generations_id";
  DROP TYPE IF EXISTS "public"."enum_ai_image_generations_provider";
  DROP TYPE IF EXISTS "public"."enum_ai_image_generations_status";`)
}
