import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "resources" ADD COLUMN "owner_id" integer;
  UPDATE "resources" SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);
  ALTER TABLE "resources" ALTER COLUMN "owner_id" SET NOT NULL;
  ALTER TABLE "resources" ADD CONSTRAINT "resources_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "resources_owner_idx" ON "resources" USING btree ("owner_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "resources" DROP CONSTRAINT "resources_owner_id_users_id_fk";
  
  DROP INDEX "resources_owner_idx";
  ALTER TABLE "resources" DROP COLUMN "owner_id";`)
}
