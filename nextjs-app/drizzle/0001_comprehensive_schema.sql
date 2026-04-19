-- GH-011: Comprehensive Database Schema (All 10 Tables + Migrations)
-- UTF-8 encoding, soft deletes, proper timestamps, JSONB support

-- ============================================================================
-- Create ENUMs
-- ============================================================================

CREATE TYPE "public"."entry_role" AS ENUM('translator', 'reviewer', 'admin', 'reader');
--> statement-breakpoint

CREATE TYPE "public"."feedback_type" AS ENUM('upvote', 'downvote', 'comment', 'flag');
--> statement-breakpoint

CREATE TYPE "public"."translation_status" AS ENUM('untranslated', 'draft', 'ready_for_review', 'approved');
--> statement-breakpoint

-- ============================================================================
-- TABLE 1: organizations
-- ============================================================================

CREATE TABLE "public"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"default_language" varchar(10) DEFAULT 'ml',
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE UNIQUE INDEX "organizations_slug_idx" ON "public"."organizations" USING btree ("slug");
--> statement-breakpoint

-- ============================================================================
-- TABLE 2: users
-- ============================================================================

CREATE TABLE "public"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"preferred_language" varchar(10) DEFAULT 'ml',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE UNIQUE INDEX "users_email_idx" ON "public"."users" USING btree ("email");
--> statement-breakpoint

-- ============================================================================
-- TABLE 3: org_memberships
-- ============================================================================

CREATE TABLE "public"."org_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "public"."entry_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "org_memberships_org_user_idx" ON "public"."org_memberships" USING btree ("org_id", "user_id");
--> statement-breakpoint

ALTER TABLE "public"."org_memberships" ADD CONSTRAINT "org_memberships_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "public"."org_memberships" ADD CONSTRAINT "org_memberships_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- TABLE 4: resources
-- ============================================================================

CREATE TABLE "public"."resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"source" varchar(50) NOT NULL,
	"format" varchar(50) NOT NULL,
	"language_code" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "resources_org_slug_idx" ON "public"."resources" USING btree ("org_id", "slug");
--> statement-breakpoint

ALTER TABLE "public"."resources" ADD CONSTRAINT "resources_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- TABLE 5: resource_versions
-- ============================================================================

CREATE TABLE "public"."resource_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"version" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"imported_at" timestamp with time zone,
	"checksum" varchar(64),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "resource_versions_resource_idx" ON "public"."resource_versions" USING btree ("resource_id");
--> statement-breakpoint

ALTER TABLE "public"."resource_versions" ADD CONSTRAINT "resource_versions_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- TABLE 6: resource_entries
-- ============================================================================

CREATE TABLE "public"."resource_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_version_id" uuid NOT NULL,
	"entry_key" varchar(255) NOT NULL,
	"source_content" jsonb NOT NULL,
	"source_language" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "resource_entries_version_key_idx" ON "public"."resource_entries" USING btree ("resource_version_id", "entry_key");
--> statement-breakpoint

ALTER TABLE "public"."resource_entries" ADD CONSTRAINT "resource_entries_version_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- TABLE 7: entry_translations
-- ============================================================================

CREATE TABLE "public"."entry_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"target_language" varchar(10) NOT NULL,
	"status" "public"."translation_status" NOT NULL DEFAULT 'untranslated',
	"translated_content" text,
	"notes" text,
	"assigned_to_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "entry_translations_entry_language_idx" ON "public"."entry_translations" USING btree ("entry_id", "target_language");
--> statement-breakpoint

ALTER TABLE "public"."entry_translations" ADD CONSTRAINT "entry_translations_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."resource_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "public"."entry_translations" ADD CONSTRAINT "entry_translations_assigned_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- TABLE 8: entry_custom_fields
-- ============================================================================

CREATE TABLE "public"."entry_custom_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"field_name" varchar(255) NOT NULL,
	"field_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "entry_custom_fields_entry_field_idx" ON "public"."entry_custom_fields" USING btree ("entry_id", "field_name");
--> statement-breakpoint

ALTER TABLE "public"."entry_custom_fields" ADD CONSTRAINT "entry_custom_fields_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."resource_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- TABLE 9: community_feedback
-- ============================================================================

CREATE TABLE "public"."community_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"feedback_type" "public"."feedback_type" NOT NULL,
	"reader_name" varchar(255),
	"feedback_text" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"flagged_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "community_feedback_entry_idx" ON "public"."community_feedback" USING btree ("entry_id");
--> statement-breakpoint

CREATE INDEX "community_feedback_ip_idx" ON "public"."community_feedback" USING btree ("ip_address");
--> statement-breakpoint

ALTER TABLE "public"."community_feedback" ADD CONSTRAINT "community_feedback_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."resource_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- TABLE 10: prompt_profiles
-- ============================================================================

CREATE TABLE "public"."prompt_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"prompts" jsonb NOT NULL,
	"is_shareable" varchar(10) DEFAULT 'false',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "prompt_profiles_user_idx" ON "public"."prompt_profiles" USING btree ("user_id");
--> statement-breakpoint

CREATE INDEX "prompt_profiles_org_user_idx" ON "public"."prompt_profiles" USING btree ("org_id", "user_id");
--> statement-breakpoint

ALTER TABLE "public"."prompt_profiles" ADD CONSTRAINT "prompt_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "public"."prompt_profiles" ADD CONSTRAINT "prompt_profiles_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ============================================================================
-- Notes
-- ============================================================================
-- UTF-8: All TEXT/VARCHAR columns use UTF-8 by default in PostgreSQL
-- Soft deletes: All tables have deleted_at (nullable timestamp) for logical deletes
-- Timestamps: created_at, updated_at default to NOW() and use timezone-aware type
-- JSONB: source_content, metadata, field_value, prompts use JSONB for indexable JSON
-- Cascade deletes: FK relations use ON DELETE cascade for related records
-- Indexes: Composite indexes on org_id+slug, entry_id+language, etc. for query performance
