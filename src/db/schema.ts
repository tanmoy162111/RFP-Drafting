import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { Fact } from '../domain/types';
import {
  ANSWER_TYPES,
  DOCUMENT_KINDS,
  DRAFT_STATUSES,
  EMBEDDING_DIMS,
  FINDING_KINDS,
  PARSE_STATUSES,
  REASON_CODES,
  REVIEW_DECISIONS,
  SOURCE_KINDS,
  SOURCE_STATUSES,
} from '../shared/constants';

export const sourceKindEnum = pgEnum('source_kind', SOURCE_KINDS);
export const sourceStatusEnum = pgEnum('source_status', SOURCE_STATUSES);
export const documentKindEnum = pgEnum('document_kind', DOCUMENT_KINDS);
export const answerTypeEnum = pgEnum('answer_type', ANSWER_TYPES);
export const parseStatusEnum = pgEnum('parse_status', PARSE_STATUSES);
export const draftStatusEnum = pgEnum('draft_status', DRAFT_STATUSES);
export const reasonCodeEnum = pgEnum('reason_code', REASON_CODES);
export const reviewDecisionEnum = pgEnum('review_decision', REVIEW_DECISIONS);
export const findingKindEnum = pgEnum('finding_kind', FINDING_KINDS);

export const librarySources = pgTable(
  'library_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    kind: sourceKindEnum('kind').notNull(),
    owner: text('owner').notNull(),
    lastReviewedAt: date('last_reviewed_at', { mode: 'string' }).notNull(),
    status: sourceStatusEnum('status').notNull(),
    mock: boolean('mock').notNull().default(true),
  },
  (t) => [check('library_sources_mock_true', sql`${t.mock} = true`)],
);

export const libraryEntries = pgTable(
  'library_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => librarySources.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    topic: text('topic').notNull(),
    text: text('text').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMS }).notNull(),
    facts: jsonb('facts').$type<Fact[]>().notNull().default(sql`'[]'::jsonb`),
    effectiveDate: date('effective_date', { mode: 'string' }),
    supersedesId: uuid('supersedes_id').references((): AnyPgColumn => libraryEntries.id),
  },
  (t) => [unique('library_entries_source_ordinal').on(t.sourceId, t.ordinal)],
);

export const rfpDocuments = pgTable('rfp_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  kind: documentKindEnum('kind').notNull(),
  title: text('title').notNull(),
  heldOut: boolean('held_out').notNull().default(false),
});

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => rfpDocuments.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    section: text('section').notNull(),
    /** For unparsed rows this holds the raw line. */
    text: text('text').notNull(),
    answerType: answerTypeEnum('answer_type').notNull(),
    parseStatus: parseStatusEnum('parse_status').notNull().default('parsed'),
  },
  (t) => [unique('questions_document_ordinal').on(t.documentId, t.ordinal)],
);

export const drafts = pgTable(
  'drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .unique()
      .references(() => questions.id, { onDelete: 'cascade' }),
    status: draftStatusEnum('status').notNull(),
    reasonCode: reasonCodeEnum('reason_code'),
    answerText: text('answer_text'),
    model: text('model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'drafts_needs_human_shape',
      sql`${t.status} <> 'needs_human' OR (${t.answerText} IS NULL AND ${t.reasonCode} IS NOT NULL)`,
    ),
    check(
      'drafts_draftable_shape',
      sql`${t.status} <> 'draftable' OR (${t.answerText} IS NOT NULL AND ${t.reasonCode} IS NULL)`,
    ),
  ],
);

export const citations = pgTable('citations', {
  id: uuid('id').primaryKey().defaultRandom(),
  draftId: uuid('draft_id')
    .notNull()
    .references(() => drafts.id, { onDelete: 'cascade' }),
  entryId: uuid('entry_id')
    .notNull()
    .references(() => libraryEntries.id),
  quoteSpan: text('quote_span'),
});

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    draftId: uuid('draft_id')
      .notNull()
      .unique()
      .references(() => drafts.id, { onDelete: 'cascade' }),
    reviewer: text('reviewer').notNull(),
    decision: reviewDecisionEnum('decision').notNull(),
    finalText: text('final_text'),
    editDistance: integer('edit_distance').notNull().default(0),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('reviews_edit_needs_text', sql`${t.decision} <> 'edit' OR ${t.finalText} IS NOT NULL`)],
);

export const exportsTable = pgTable('exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => rfpDocuments.id),
  reviewId: uuid('review_id')
    .notNull()
    .unique()
    .references(() => reviews.id),
  exportedAt: timestamp('exported_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditFindings = pgTable(
  'audit_findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: findingKindEnum('kind').notNull(),
    sourceId: uuid('source_id').references(() => librarySources.id, { onDelete: 'cascade' }),
    entryId: uuid('entry_id').references(() => libraryEntries.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id').references(() => questions.id, { onDelete: 'cascade' }),
    detail: text('detail').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('audit_findings_has_target', sql`num_nonnulls(${t.sourceId}, ${t.entryId}, ${t.questionId}) >= 1`),
  ],
);
