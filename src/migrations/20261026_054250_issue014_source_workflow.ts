import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ai_generations_current_step" AS ENUM('facts', 'draft', 'complete');
  ALTER TABLE "ai_generations" ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "ai_generations" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum_ai_generations_status";
  CREATE TYPE "public"."enum_ai_generations_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled', 'saved_as_draft');
  ALTER TABLE "ai_generations" ALTER COLUMN "status" SET DATA TYPE "public"."enum_ai_generations_status" USING "status"::"public"."enum_ai_generations_status";
  CREATE TABLE "ai_generations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"resources_id" integer,
  	"source_materials_id" integer
  );
  
  ALTER TABLE "ai_generations" ALTER COLUMN "status" SET DEFAULT 'queued'::"public"."enum_ai_generations_status";
  ALTER TABLE "posts_rels" ADD COLUMN "resources_id" integer;
  ALTER TABLE "posts_rels" ADD COLUMN "source_materials_id" integer;
  ALTER TABLE "_posts_v_rels" ADD COLUMN "resources_id" integer;
  ALTER TABLE "_posts_v_rels" ADD COLUMN "source_materials_id" integer;
  ALTER TABLE "ai_generations" ADD COLUMN "current_step" "enum_ai_generations_current_step" DEFAULT 'facts' NOT NULL;
  ALTER TABLE "ai_generations" ADD COLUMN "fact_package" jsonb;
  ALTER TABLE "ai_generations" ADD COLUMN "retry_count" numeric DEFAULT 0 NOT NULL;
  ALTER TABLE "ai_generations" ADD COLUMN "model_call_count" numeric DEFAULT 0 NOT NULL;
  UPDATE "ai_generations" SET "model_call_count" = 1;
  ALTER TABLE "ai_generations_rels" ADD CONSTRAINT "ai_generations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_generations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_generations_rels" ADD CONSTRAINT "ai_generations_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_generations_rels" ADD CONSTRAINT "ai_generations_rels_source_materials_fk" FOREIGN KEY ("source_materials_id") REFERENCES "public"."source_materials"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ai_generations_rels_order_idx" ON "ai_generations_rels" USING btree ("order");
  CREATE INDEX "ai_generations_rels_parent_idx" ON "ai_generations_rels" USING btree ("parent_id");
  CREATE INDEX "ai_generations_rels_path_idx" ON "ai_generations_rels" USING btree ("path");
  CREATE INDEX "ai_generations_rels_resources_id_idx" ON "ai_generations_rels" USING btree ("resources_id");
  CREATE INDEX "ai_generations_rels_source_materials_id_idx" ON "ai_generations_rels" USING btree ("source_materials_id");
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_source_materials_fk" FOREIGN KEY ("source_materials_id") REFERENCES "public"."source_materials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_source_materials_fk" FOREIGN KEY ("source_materials_id") REFERENCES "public"."source_materials"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_rels_resources_id_idx" ON "posts_rels" USING btree ("resources_id");
  CREATE INDEX "posts_rels_source_materials_id_idx" ON "posts_rels" USING btree ("source_materials_id");
  CREATE INDEX "_posts_v_rels_resources_id_idx" ON "_posts_v_rels" USING btree ("resources_id");
  CREATE INDEX "_posts_v_rels_source_materials_id_idx" ON "_posts_v_rels" USING btree ("source_materials_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ai_generations_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ai_generations_rels" CASCADE;
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_resources_fk";
  
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_source_materials_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_resources_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_source_materials_fk";
  
  UPDATE "ai_generations" SET "status" = 'running' WHERE "status" = 'queued';
  UPDATE "ai_generations" SET "status" = 'failed' WHERE "status" = 'cancelled';
  ALTER TABLE "ai_generations" ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "ai_generations" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "ai_generations" ALTER COLUMN "status" SET DEFAULT 'running'::text;
  DROP TYPE "public"."enum_ai_generations_status";
  CREATE TYPE "public"."enum_ai_generations_status" AS ENUM('running', 'succeeded', 'failed', 'saved_as_draft');
  ALTER TABLE "ai_generations" ALTER COLUMN "status" SET DEFAULT 'running'::"public"."enum_ai_generations_status";
  ALTER TABLE "ai_generations" ALTER COLUMN "status" SET DATA TYPE "public"."enum_ai_generations_status" USING "status"::"public"."enum_ai_generations_status";
  DROP INDEX "posts_rels_resources_id_idx";
  DROP INDEX "posts_rels_source_materials_id_idx";
  DROP INDEX "_posts_v_rels_resources_id_idx";
  DROP INDEX "_posts_v_rels_source_materials_id_idx";
  ALTER TABLE "posts_rels" DROP COLUMN "resources_id";
  ALTER TABLE "posts_rels" DROP COLUMN "source_materials_id";
  ALTER TABLE "_posts_v_rels" DROP COLUMN "resources_id";
  ALTER TABLE "_posts_v_rels" DROP COLUMN "source_materials_id";
  ALTER TABLE "ai_generations" DROP COLUMN "current_step";
  ALTER TABLE "ai_generations" DROP COLUMN "fact_package";
  ALTER TABLE "ai_generations" DROP COLUMN "retry_count";
  ALTER TABLE "ai_generations" DROP COLUMN "model_call_count";
  DROP TYPE "public"."enum_ai_generations_current_step";`)
}
