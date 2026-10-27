import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_source_materials_material_type" AS ENUM('typed_note', 'pdf', 'owned_image', 'authorized_original');
  CREATE TYPE "public"."enum_source_materials_authorization_basis" AS ENUM('owned', 'permission', 'open_license', 'public_domain');
  CREATE TYPE "public"."enum_source_materials_privacy" AS ENUM('private');
  CREATE TYPE "public"."enum_source_materials_storage_driver" AS ENUM('local', 'cos');
  CREATE TABLE "source_materials" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"material_type" "enum_source_materials_material_type" DEFAULT 'typed_note' NOT NULL,
  	"source_id" varchar NOT NULL,
  	"personal_notes" varchar,
  	"source_description" varchar,
  	"authorized_text" varchar,
  	"authorization_basis" "enum_source_materials_authorization_basis" NOT NULL,
  	"authorization_note" varchar NOT NULL,
  	"source_url" varchar,
  	"source_title" varchar,
  	"source_author" varchar,
  	"source_date" timestamp(3) with time zone,
  	"captured_at" timestamp(3) with time zone NOT NULL,
  	"author_id" integer NOT NULL,
  	"privacy" "enum_source_materials_privacy" DEFAULT 'private' NOT NULL,
  	"original_file_name" varchar,
  	"mime_type" varchar,
  	"byte_size" numeric,
  	"sha256" varchar,
  	"storage_driver" "enum_source_materials_storage_driver",
  	"storage_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "source_materials_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"resources_id" integer,
  	"posts_id" integer,
  	"projects_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "source_materials_id" integer;
  ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "source_materials_rels" ADD CONSTRAINT "source_materials_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."source_materials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "source_materials_rels" ADD CONSTRAINT "source_materials_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "source_materials_rels" ADD CONSTRAINT "source_materials_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "source_materials_rels" ADD CONSTRAINT "source_materials_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "source_materials_material_type_idx" ON "source_materials" USING btree ("material_type");
  CREATE UNIQUE INDEX "source_materials_source_id_idx" ON "source_materials" USING btree ("source_id");
  CREATE INDEX "source_materials_captured_at_idx" ON "source_materials" USING btree ("captured_at");
  CREATE INDEX "source_materials_author_idx" ON "source_materials" USING btree ("author_id");
  CREATE INDEX "source_materials_privacy_idx" ON "source_materials" USING btree ("privacy");
  CREATE INDEX "source_materials_mime_type_idx" ON "source_materials" USING btree ("mime_type");
  CREATE UNIQUE INDEX "source_materials_sha256_idx" ON "source_materials" USING btree ("sha256");
  CREATE UNIQUE INDEX "source_materials_storage_key_idx" ON "source_materials" USING btree ("storage_key");
  CREATE INDEX "source_materials_updated_at_idx" ON "source_materials" USING btree ("updated_at");
  CREATE INDEX "source_materials_created_at_idx" ON "source_materials" USING btree ("created_at");
  CREATE INDEX "source_materials_rels_order_idx" ON "source_materials_rels" USING btree ("order");
  CREATE INDEX "source_materials_rels_parent_idx" ON "source_materials_rels" USING btree ("parent_id");
  CREATE INDEX "source_materials_rels_path_idx" ON "source_materials_rels" USING btree ("path");
  CREATE INDEX "source_materials_rels_resources_id_idx" ON "source_materials_rels" USING btree ("resources_id");
  CREATE INDEX "source_materials_rels_posts_id_idx" ON "source_materials_rels" USING btree ("posts_id");
  CREATE INDEX "source_materials_rels_projects_id_idx" ON "source_materials_rels" USING btree ("projects_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_source_materials_fk" FOREIGN KEY ("source_materials_id") REFERENCES "public"."source_materials"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_source_materials_id_idx" ON "payload_locked_documents_rels" USING btree ("source_materials_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_source_materials_fk";
  DROP INDEX "payload_locked_documents_rels_source_materials_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "source_materials_id";
  ALTER TABLE "source_materials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "source_materials_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "source_materials_rels" CASCADE;
  DROP TABLE "source_materials" CASCADE;
  DROP TYPE "public"."enum_source_materials_material_type";
  DROP TYPE "public"."enum_source_materials_authorization_basis";
  DROP TYPE "public"."enum_source_materials_privacy";
  DROP TYPE "public"."enum_source_materials_storage_driver";`)
}
