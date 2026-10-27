import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_ai_image_generations_provider" ADD VALUE IF NOT EXISTS 'qmg2s';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "ai_image_generations" ALTER COLUMN "provider" TYPE varchar;
    DROP TYPE "public"."enum_ai_image_generations_provider";
    CREATE TYPE "public"."enum_ai_image_generations_provider" AS ENUM('sophnet');
    ALTER TABLE "ai_image_generations" ALTER COLUMN "provider" TYPE "public"."enum_ai_image_generations_provider"
      USING "provider"::"public"."enum_ai_image_generations_provider";
  `)
}
