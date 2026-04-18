import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  integer,
  foreignKey,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMs
// ============================================================================

export const translationStatusEnum = pgEnum('translation_status', [
  'untranslated',
  'draft',
  'ready_for_review',
  'approved',
]);

export const entryRoleEnum = pgEnum('entry_role', [
  'translator',
  'reviewer',
  'admin',
  'reader',
]);

export const feedbackTypeEnum = pgEnum('feedback_type', [
  'upvote',
  'downvote',
  'comment',
  'flag',
]);

// Legacy Auth.js support
export const providerEnum = pgEnum('api_provider', ['gemini', 'openai']);

// ============================================================================
// TABLE 1: organizations
// ============================================================================

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    default_language: varchar('default_language', { length: 10 }).default('ml'),
    logo_url: text('logo_url'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
  })
);

// ============================================================================
// TABLE 2: users
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    password: text('password'),
    name: text('name'),
    created_at: timestamp('created_at', { withTimezone: true }),
  }
);


// ============================================================================
// TABLE 3: org_memberships
// ============================================================================

export const orgMemberships = pgTable(
  'org_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id').notNull(),
    user_id: uuid('user_id').notNull(),
    role: entryRoleEnum('role').notNull(),
    joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    orgUserIdx: index('org_memberships_org_user_idx').on(table.org_id, table.user_id),
    orgIdFk: foreignKey({
      columns: [table.org_id],
      foreignColumns: [organizations.id],
    }).onDelete('cascade'),
    userIdFk: foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
  })
);

// ============================================================================
// TABLE 4: resources
// ============================================================================

export const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    source: varchar('source', { length: 50 }).notNull(),
    format: varchar('format', { length: 50 }).notNull(),
    language_code: varchar('language_code', { length: 10 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    orgSlugIdx: index('resources_org_slug_idx').on(table.org_id, table.slug),
    orgIdFk: foreignKey({
      columns: [table.org_id],
      foreignColumns: [organizations.id],
    }).onDelete('cascade'),
  })
);

// ============================================================================
// TABLE 5: resource_versions
// ============================================================================

export const resourceVersions = pgTable(
  'resource_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resource_id: uuid('resource_id').notNull(),
    version: varchar('version', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    imported_at: timestamp('imported_at', { withTimezone: true }),
    checksum: varchar('checksum', { length: 64 }),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    resourceVersionIdx: index('resource_versions_resource_idx').on(table.resource_id),
    resourceIdFk: foreignKey({
      columns: [table.resource_id],
      foreignColumns: [resources.id],
    }).onDelete('cascade'),
  })
);

// ============================================================================
// TABLE 6: resource_entries
// ============================================================================

export const resourceEntries = pgTable(
  'resource_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resource_version_id: uuid('resource_version_id').notNull(),
    entry_key: varchar('entry_key', { length: 255 }).notNull(),
    source_content: jsonb('source_content').notNull(),
    source_language: varchar('source_language', { length: 10 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    versionKeyIdx: index('resource_entries_version_key_idx').on(
      table.resource_version_id,
      table.entry_key
    ),
    versionIdFk: foreignKey({
      columns: [table.resource_version_id],
      foreignColumns: [resourceVersions.id],
    }).onDelete('cascade'),
  })
);

// ============================================================================
// TABLE 7: entry_translations
// ============================================================================

export const entryTranslations = pgTable(
  'entry_translations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entry_id: uuid('entry_id').notNull(),
    target_language: varchar('target_language', { length: 10 }).notNull(),
    status: translationStatusEnum('status').notNull().default('untranslated'),
    translated_content: text('translated_content'),
    notes: text('notes'),
    assigned_to_user_id: uuid('assigned_to_user_id'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    entryLanguageIdx: index('entry_translations_entry_language_idx').on(
      table.entry_id,
      table.target_language
    ),
    entryIdFk: foreignKey({
      columns: [table.entry_id],
      foreignColumns: [resourceEntries.id],
    }).onDelete('cascade'),
    assignedUserFk: foreignKey({
      columns: [table.assigned_to_user_id],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  })
);

// ============================================================================
// TABLE 8: entry_custom_fields
// ============================================================================

export const entryCustomFields = pgTable(
  'entry_custom_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entry_id: uuid('entry_id').notNull(),
    field_name: varchar('field_name', { length: 255 }).notNull(),
    field_value: jsonb('field_value'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    entryFieldIdx: index('entry_custom_fields_entry_field_idx').on(
      table.entry_id,
      table.field_name
    ),
    entryIdFk: foreignKey({
      columns: [table.entry_id],
      foreignColumns: [resourceEntries.id],
    }).onDelete('cascade'),
  })
);

// ============================================================================
// TABLE 9: community_feedback
// ============================================================================

export const communityFeedback = pgTable(
  'community_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entry_id: uuid('entry_id').notNull(),
    feedback_type: feedbackTypeEnum('feedback_type').notNull(),
    reader_name: varchar('reader_name', { length: 255 }),
    feedback_text: text('feedback_text'),
    ip_address: varchar('ip_address', { length: 45 }),
    user_agent: text('user_agent'),
    flagged_reason: text('flagged_reason'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    entryFeedbackIdx: index('community_feedback_entry_idx').on(table.entry_id),
    ipIdx: index('community_feedback_ip_idx').on(table.ip_address),
    entryIdFk: foreignKey({
      columns: [table.entry_id],
      foreignColumns: [resourceEntries.id],
    }).onDelete('cascade'),
  })
);

// ============================================================================
// TABLE 10: prompt_profiles
// ============================================================================

export const promptProfiles = pgTable(
  'prompt_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    org_id: uuid('org_id'),
    user_id: uuid('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    prompts: jsonb('prompts').notNull(),
    is_shareable: varchar('is_shareable', { length: 10 }).default('false'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index('prompt_profiles_user_idx').on(table.user_id),
    orgUserIdx: index('prompt_profiles_org_user_idx').on(table.org_id, table.user_id),
    userIdFk: foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    orgIdFk: foreignKey({
      columns: [table.org_id],
      foreignColumns: [organizations.id],
    }).onDelete('cascade'),
  })
);

// ============================================================================
// LEGACY AUTH.JS TABLES (for backward compatibility)
// ============================================================================

export const accounts = pgTable(
  'account',
  {
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<'oauth' | 'credentials'>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (account) => ({
    compoundKey: uniqueIndex('account_provider_key').on(
      account.provider,
      account.providerAccountId
    ),
  })
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_token',
  {
    email: text('email').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (vt) => ({
    compoundKey: uniqueIndex('verification_token_email_token').on(vt.email, vt.token),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(orgMemberships),
  resources: many(resources),
  prompt_profiles: many(promptProfiles),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(orgMemberships),
  assigned_translations: many(entryTranslations),
  prompt_profiles: many(promptProfiles),
}));

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMemberships.org_id],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMemberships.user_id],
    references: [users.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [resources.org_id],
    references: [organizations.id],
  }),
  versions: many(resourceVersions),
}));

export const resourceVersionsRelations = relations(
  resourceVersions,
  ({ one, many }) => ({
    resource: one(resources, {
      fields: [resourceVersions.resource_id],
      references: [resources.id],
    }),
    entries: many(resourceEntries),
  })
);

export const resourceEntriesRelations = relations(resourceEntries, ({ one, many }) => ({
  resource_version: one(resourceVersions, {
    fields: [resourceEntries.resource_version_id],
    references: [resourceVersions.id],
  }),
  translations: many(entryTranslations),
  custom_fields: many(entryCustomFields),
  community_feedback: many(communityFeedback),
}));

export const entryTranslationsRelations = relations(entryTranslations, ({ one }) => ({
  entry: one(resourceEntries, {
    fields: [entryTranslations.entry_id],
    references: [resourceEntries.id],
  }),
  assigned_user: one(users, {
    fields: [entryTranslations.assigned_to_user_id],
    references: [users.id],
  }),
}));

export const entryCustomFieldsRelations = relations(entryCustomFields, ({ one }) => ({
  entry: one(resourceEntries, {
    fields: [entryCustomFields.entry_id],
    references: [resourceEntries.id],
  }),
}));

export const communityFeedbackRelations = relations(communityFeedback, ({ one }) => ({
  entry: one(resourceEntries, {
    fields: [communityFeedback.entry_id],
    references: [resourceEntries.id],
  }),
}));

export const promptProfilesRelations = relations(promptProfiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [promptProfiles.org_id],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [promptProfiles.user_id],
    references: [users.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type OrgMembership = typeof orgMemberships.$inferSelect;
export type NewOrgMembership = typeof orgMemberships.$inferInsert;

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

export type ResourceVersion = typeof resourceVersions.$inferSelect;
export type NewResourceVersion = typeof resourceVersions.$inferInsert;

export type ResourceEntry = typeof resourceEntries.$inferSelect;
export type NewResourceEntry = typeof resourceEntries.$inferInsert;

export type EntryTranslation = typeof entryTranslations.$inferSelect;
export type NewEntryTranslation = typeof entryTranslations.$inferInsert;

export type EntryCustomField = typeof entryCustomFields.$inferSelect;
export type NewEntryCustomField = typeof entryCustomFields.$inferInsert;

export type CommunityFeedback = typeof communityFeedback.$inferSelect;
export type NewCommunityFeedback = typeof communityFeedback.$inferInsert;

export type PromptProfile = typeof promptProfiles.$inferSelect;
export type NewPromptProfile = typeof promptProfiles.$inferInsert;

export type TranslationStatus = typeof translationStatusEnum.enumValues[number];
export type EntryRole = typeof entryRoleEnum.enumValues[number];
export type FeedbackType = typeof feedbackTypeEnum.enumValues[number];
