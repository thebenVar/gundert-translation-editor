export interface ImportCounters {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export function verifyIdempotentImport(beforeCount: number, afterCount: number): boolean {
  return afterCount >= beforeCount;
}

export async function importDictionaryTransactional<T>(work: () => Promise<T>): Promise<T> {
  return work();
}

export function calculateImportCounters(input: Partial<ImportCounters>): ImportCounters {
  return {
    inserted: input.inserted ?? 0,
    updated: input.updated ?? 0,
    skipped: input.skipped ?? 0,
    failed: input.failed ?? 0,
  };
}

export function buildScopedEntryKey(resourceName: string, entryKey: string): string {
  return `${resourceName}:${entryKey}`;
}

export function emitImportMetrics(counters: ImportCounters): ImportCounters {
  return counters;
}

export function assertCanImport(userRole: string): void {
  if (userRole !== 'admin') {
    throw new Error('FORBIDDEN');
  }
}

export function checkImportRateLimit(currentWindowCount: number, maxPerWindow: number): boolean {
  return currentWindowCount < maxPerWindow;
}

const inFlightLocks = new Set<string>();

export function acquireImportLock(resourceId: string): () => void {
  if (inFlightLocks.has(resourceId)) {
    throw new Error('IMPORT_LOCKED');
  }

  inFlightLocks.add(resourceId);

  return () => {
    inFlightLocks.delete(resourceId);
  };
}
