CREATE TYPE "public"."answer_type" AS ENUM('yes_no', 'narrative', 'choice');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('rfp', 'questionnaire');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('draftable', 'needs_human');--> statement-breakpoint
CREATE TYPE "public"."finding_kind" AS ENUM('stale', 'conflict', 'duplicate', 'gap');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('parsed', 'unparsed');--> statement-breakpoint
CREATE TYPE "public"."reason_code" AS ENUM('conflict', 'stale', 'no_evidence', 'low_confidence');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('accept', 'edit', 'reject');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('past_proposal', 'policy', 'approved_answer', 'certification');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('approved', 'draft', 'deprecated');--> statement-breakpoint
CREATE TABLE "audit_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "finding_kind" NOT NULL,
	"source_id" uuid,
	"entry_id" uuid,
	"question_id" uuid,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_findings_has_target" CHECK (num_nonnulls("audit_findings"."source_id", "audit_findings"."entry_id", "audit_findings"."question_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"quote_span" text
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"status" "draft_status" NOT NULL,
	"reason_code" "reason_code",
	"answer_text" text,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_question_id_unique" UNIQUE("question_id"),
	CONSTRAINT "drafts_needs_human_shape" CHECK ("drafts"."status" <> 'needs_human' OR ("drafts"."answer_text" IS NULL AND "drafts"."reason_code" IS NOT NULL)),
	CONSTRAINT "drafts_draftable_shape" CHECK ("drafts"."status" <> 'draftable' OR ("drafts"."answer_text" IS NOT NULL AND "drafts"."reason_code" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exports_review_id_unique" UNIQUE("review_id")
);
--> statement-breakpoint
CREATE TABLE "library_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"topic" text NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(256) NOT NULL,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effective_date" date,
	"supersedes_id" uuid,
	CONSTRAINT "library_entries_source_ordinal" UNIQUE("source_id","ordinal")
);
--> statement-breakpoint
CREATE TABLE "library_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"kind" "source_kind" NOT NULL,
	"owner" text NOT NULL,
	"last_reviewed_at" date NOT NULL,
	"status" "source_status" NOT NULL,
	"mock" boolean DEFAULT true NOT NULL,
	CONSTRAINT "library_sources_slug_unique" UNIQUE("slug"),
	CONSTRAINT "library_sources_mock_true" CHECK ("library_sources"."mock" = true)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"section" text NOT NULL,
	"text" text NOT NULL,
	"answer_type" "answer_type" NOT NULL,
	"parse_status" "parse_status" DEFAULT 'parsed' NOT NULL,
	CONSTRAINT "questions_document_ordinal" UNIQUE("document_id","ordinal")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"reviewer" text NOT NULL,
	"decision" "review_decision" NOT NULL,
	"final_text" text,
	"edit_distance" integer DEFAULT 0 NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_draft_id_unique" UNIQUE("draft_id"),
	CONSTRAINT "reviews_edit_needs_text" CHECK ("reviews"."decision" <> 'edit' OR "reviews"."final_text" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "rfp_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "document_kind" NOT NULL,
	"title" text NOT NULL,
	"held_out" boolean DEFAULT false NOT NULL,
	CONSTRAINT "rfp_documents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_source_id_library_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."library_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_entry_id_library_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_entry_id_library_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."library_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_document_id_rfp_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rfp_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_source_id_library_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."library_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_supersedes_id_library_entries_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."library_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_document_id_rfp_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rfp_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;