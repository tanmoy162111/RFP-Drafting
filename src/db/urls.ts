const BASE = 'postgres://rfp:rfp@127.0.0.1:5435';

export const appUrl = (): string => process.env.DATABASE_URL ?? `${BASE}/rfp_drafting`;
export const testUrl = (): string => process.env.TEST_DATABASE_URL ?? `${BASE}/rfp_drafting_test`;
export const adminUrl = (): string => process.env.ADMIN_DATABASE_URL ?? `${BASE}/postgres`;
