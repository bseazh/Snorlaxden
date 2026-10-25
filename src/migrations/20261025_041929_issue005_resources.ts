import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_resources_resource_type" AS ENUM('note', 'video', 'book', 'image', 'activity', 'link');
  CREATE TYPE "public"."enum_resources_platform" AS ENUM('bilibili', 'youtube', 'wechat_channels', 'web');
  CREATE TYPE "public"."enum_resources_source_access" AS ENUM('url_only', 'metadata', 'user_supplied_text', 'authorized_transcript', 'self_owned_media');
  CREATE TYPE "public"."enum_resources_ingest_status" AS ENUM('saved_only', 'metadata_ready', 'text_ready', 'card_draft', 'reviewed', 'failed');
  CREATE TYPE "public"."enum_resources_visibility" AS ENUM('private', 'review', 'public');
  CREATE TABLE "resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"resource_type" "enum_resources_resource_type" DEFAULT 'note' NOT NULL,
  	"notes" varchar,
  	"source_description" varchar,
  	"source_url" varchar,
  	"canonical_url" varchar,
  	"source_key" varchar,
  	"source_id" varchar NOT NULL,
  	"platform" "enum_resources_platform",
  	"external_id" varchar,
  	"source_access" "enum_resources_source_access" DEFAULT 'url_only' NOT NULL,
  	"ingest_status" "enum_resources_ingest_status" DEFAULT 'saved_only' NOT NULL,
  	"visibility" "enum_resources_visibility" DEFAULT 'private' NOT NULL,
  	"captured_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "resources_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer,
  	"posts_id" integer,
  	"projects_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "resources_id" integer;
  ALTER TABLE "resources_rels" ADD CONSTRAINT "resources_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resources_rels" ADD CONSTRAINT "resources_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resources_rels" ADD CONSTRAINT "resources_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resources_rels" ADD CONSTRAINT "resources_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "resources_resource_type_idx" ON "resources" USING btree ("resource_type");
  CREATE INDEX "resources_canonical_url_idx" ON "resources" USING btree ("canonical_url");
  CREATE UNIQUE INDEX "resources_source_key_idx" ON "resources" USING btree ("source_key");
  CREATE UNIQUE INDEX "resources_source_id_idx" ON "resources" USING btree ("source_id");
  CREATE INDEX "resources_external_id_idx" ON "resources" USING btree ("external_id");
  CREATE INDEX "resources_ingest_status_idx" ON "resources" USING btree ("ingest_status");
  CREATE INDEX "resources_visibility_idx" ON "resources" USING btree ("visibility");
  CREATE INDEX "resources_captured_at_idx" ON "resources" USING btree ("captured_at");
  CREATE INDEX "resources_updated_at_idx" ON "resources" USING btree ("updated_at");
  CREATE INDEX "resources_created_at_idx" ON "resources" USING btree ("created_at");
  CREATE INDEX "resources_rels_order_idx" ON "resources_rels" USING btree ("order");
  CREATE INDEX "resources_rels_parent_idx" ON "resources_rels" USING btree ("parent_id");
  CREATE INDEX "resources_rels_path_idx" ON "resources_rels" USING btree ("path");
  CREATE INDEX "resources_rels_tags_id_idx" ON "resources_rels" USING btree ("tags_id");
  CREATE INDEX "resources_rels_posts_id_idx" ON "resources_rels" USING btree ("posts_id");
  CREATE INDEX "resources_rels_projects_id_idx" ON "resources_rels" USING btree ("projects_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_resources_id_idx" ON "payload_locked_documents_rels" USING btree ("resources_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  	 ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_resources_fk";
  DROP INDEX "payload_locked_documents_rels_resources_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "resources_id";
  ALTER TABLE "resources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "resources_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "resources" CASCADE;
  DROP TABLE "resources_rels" CASCADE;
  DROP TYPE "public"."enum_resources_resource_type";
  DROP TYPE "public"."enum_resources_platform";
  DROP TYPE "public"."enum_resources_source_access";
  DROP TYPE "public"."enum_resources_ingest_status";
  DROP TYPE "public"."enum_resources_visibility";`)
}
