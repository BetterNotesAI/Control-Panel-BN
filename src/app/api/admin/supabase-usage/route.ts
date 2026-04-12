import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type {
  SupabaseBucketUsage,
  SupabaseQuotaMetric,
  SupabaseUsageResponse,
} from "@/types/admin";
import type { Database } from "@/types/database";

const STORAGE_PAGE_SIZE = 1000;
const DEFAULT_MAX_SCANNED_OBJECTS = 50_000;
const DEFAULT_TOP_BUCKETS = 5;

type CountableTable = keyof Database["public"]["Tables"];
type StorageObjectRow = Pick<
  Database["storage"]["Tables"]["objects"]["Row"],
  "bucket_id" | "metadata"
>;
type StorageBucketRow = Pick<
  Database["storage"]["Tables"]["buckets"]["Row"],
  "id" | "name"
>;

interface BucketAccumulator {
  objectCount: number;
  usedBytes: number;
}

interface StorageUsageSnapshot {
  totalObjects: number;
  scannedObjects: number;
  scanTruncated: boolean;
  totalUsedBytes: number;
  usageByBucket: Map<string, BucketAccumulator>;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message = typeof candidate.message === "string" ? candidate.message : "";
    const details = typeof candidate.details === "string" ? candidate.details : "";
    const hint = typeof candidate.hint === "string" ? candidate.hint : "";
    const code = typeof candidate.code === "string" ? candidate.code : "";

    const suffix = [details, hint, code ? `code=${code}` : ""]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" | ");

    if (message) {
      return suffix ? `${message} (${suffix})` : message;
    }
  }

  return fallback;
}

async function countRows(table: CountableTable): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase.from(table).select("*", {
    count: "exact",
    head: true,
  });

  if (error) {
    throw new Error(`Count failed for ${table}: ${error.message}`);
  }

  return count ?? 0;
}

function normalizeEnv(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseByteLimitFromEnv(name: string): number | null {
  const raw = normalizeEnv(process.env[name]);

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

function parsePositiveIntegerFromEnv(name: string, fallback: number): number {
  const raw = normalizeEnv(process.env[name]);

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseCsvFromEnv(name: string): string[] {
  const raw = normalizeEnv(process.env[name]);

  if (!raw) {
    return [];
  }

  return [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function extractObjectSizeBytes(metadata: Record<string, unknown> | null): number {
  if (!metadata) {
    return 0;
  }

  const parsed = toFiniteNumber(metadata.size);

  if (parsed === null || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function buildQuotaMetric(usedBytes: number | null, limitBytes: number | null): SupabaseQuotaMetric {
  if (usedBytes === null) {
    return {
      usedBytes: null,
      limitBytes,
      remainingBytes: null,
      usagePercent: null,
    };
  }

  if (limitBytes === null || limitBytes <= 0) {
    return {
      usedBytes,
      limitBytes,
      remainingBytes: null,
      usagePercent: null,
    };
  }

  return {
    usedBytes,
    limitBytes,
    remainingBytes: Math.max(limitBytes - usedBytes, 0),
    usagePercent: roundTo((usedBytes / limitBytes) * 100, 2),
  };
}

async function fetchDatabaseSizeBytes(): Promise<number | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("admin_database_size_bytes");

  if (error) {
    return null;
  }

  const parsed = toFiniteNumber(data);

  if (parsed === null || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

async function fetchStorageUsageSnapshot(maxScannedObjects: number): Promise<StorageUsageSnapshot> {
  const supabase = getSupabaseAdminClient().schema("storage");
  const { count, error } = await supabase.from("objects").select("id", {
    count: "exact",
    head: true,
  });

  if (error) {
    throw new Error(`Failed to read storage.objects count: ${error.message}`);
  }

  const totalObjects = count ?? 0;
  const usageByBucket = new Map<string, BucketAccumulator>();
  let scannedObjects = 0;
  let from = 0;

  while (from < totalObjects && scannedObjects < maxScannedObjects) {
    const pageSize = Math.min(STORAGE_PAGE_SIZE, maxScannedObjects - scannedObjects);
    const to = from + pageSize - 1;
    const { data, error: pageError } = await supabase
      .from("objects")
      .select("bucket_id,metadata")
      .order("id", { ascending: true })
      .range(from, to);

    if (pageError) {
      throw new Error(`Failed to scan storage.objects page: ${pageError.message}`);
    }

    const rows = (data ?? []) as StorageObjectRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const bucketId = row.bucket_id ?? "unknown";
      const current = usageByBucket.get(bucketId) ?? {
        objectCount: 0,
        usedBytes: 0,
      };

      current.objectCount += 1;
      current.usedBytes += extractObjectSizeBytes(row.metadata);

      usageByBucket.set(bucketId, current);
    }

    scannedObjects += rows.length;
    from += rows.length;

    if (rows.length < pageSize) {
      break;
    }
  }

  let totalUsedBytes = 0;

  for (const value of usageByBucket.values()) {
    totalUsedBytes += value.usedBytes;
  }

  return {
    totalObjects,
    scannedObjects,
    scanTruncated: scannedObjects < totalObjects,
    totalUsedBytes,
    usageByBucket,
  };
}

async function fetchStorageBuckets(): Promise<StorageBucketRow[]> {
  const supabase = getSupabaseAdminClient().schema("storage");
  const { data, error } = await supabase.from("buckets").select("id,name");

  if (error) {
    throw new Error(`Failed to read storage.buckets: ${error.message}`);
  }

  return (data ?? []) as StorageBucketRow[];
}

function buildTopBuckets(
  usageByBucket: Map<string, BucketAccumulator>,
  bucketNameMap: Map<string, string>,
  totalUsedBytes: number,
  topLimit: number,
): SupabaseBucketUsage[] {
  const result = [...usageByBucket.entries()]
    .map(([bucketId, usage]) => ({
      bucketId,
      bucketName: bucketNameMap.get(bucketId) ?? bucketId,
      objectCount: usage.objectCount,
      usedBytes: usage.usedBytes,
      usedSharePercent:
        totalUsedBytes > 0 ? roundTo((usage.usedBytes / totalUsedBytes) * 100, 2) : 0,
    }))
    .sort((a, b) => {
      if (b.usedBytes !== a.usedBytes) {
        return b.usedBytes - a.usedBytes;
      }

      return b.objectCount - a.objectCount;
    });

  return result.slice(0, topLimit);
}

export async function GET() {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const notes: string[] = [];
  const configuredPlanName = normalizeEnv(process.env.SUPABASE_PLAN_NAME);
  const databaseLimitBytes = parseByteLimitFromEnv("SUPABASE_DATABASE_LIMIT_BYTES");
  const storageLimitBytes = parseByteLimitFromEnv("SUPABASE_STORAGE_LIMIT_BYTES");
  const configuredDocumentBucketIds = parseCsvFromEnv("SUPABASE_DOCUMENT_BUCKET_IDS");
  const maxScannedObjects = parsePositiveIntegerFromEnv(
    "SUPABASE_USAGE_MAX_SCANNED_OBJECTS",
    DEFAULT_MAX_SCANNED_OBJECTS,
  );
  const topBucketCount = parsePositiveIntegerFromEnv(
    "SUPABASE_USAGE_TOP_BUCKETS",
    DEFAULT_TOP_BUCKETS,
  );

  if (!configuredPlanName) {
    notes.push("SUPABASE_PLAN_NAME is not configured.");
  }

  if (databaseLimitBytes === null) {
    notes.push("SUPABASE_DATABASE_LIMIT_BYTES is not configured.");
  }

  if (storageLimitBytes === null) {
    notes.push("SUPABASE_STORAGE_LIMIT_BYTES is not configured.");
  }

  try {
    const [profilesCount, documentsCount, problemSolverSessionsCount, userFeedbackCount, databaseUsedBytes] =
      await Promise.all([
      countRows("profiles"),
      countRows("documents"),
      countRows("problem_solver_sessions"),
      countRows("user_feedback"),
      fetchDatabaseSizeBytes(),
    ]);

    let storageSnapshot: StorageUsageSnapshot = {
      totalObjects: 0,
      scannedObjects: 0,
      scanTruncated: false,
      totalUsedBytes: 0,
      usageByBucket: new Map<string, BucketAccumulator>(),
    };
    let storageAvailable = false;

    try {
      storageSnapshot = await fetchStorageUsageSnapshot(maxScannedObjects);
      storageAvailable = true;
    } catch (storageError) {
      notes.push(
        `Storage usage is unavailable: ${extractErrorMessage(
          storageError,
          "Could not query storage.objects.",
        )}`,
      );
    }

    let storageBuckets: StorageBucketRow[] = [];
    try {
      storageBuckets = await fetchStorageBuckets();
    } catch (bucketError) {
      notes.push(
        `Storage bucket metadata is unavailable: ${extractErrorMessage(
          bucketError,
          "Could not query storage.buckets.",
        )}`,
      );
    }

    const bucketNameMap = new Map<string, string>(
      storageBuckets.map((bucket) => [bucket.id, bucket.name]),
    );
    const knownBucketIds = new Set<string>([
      ...bucketNameMap.keys(),
      ...storageSnapshot.usageByBucket.keys(),
    ]);

    let documentBucketIds = [...configuredDocumentBucketIds];
    if (documentBucketIds.length === 0 && knownBucketIds.has("documents")) {
      documentBucketIds = ["documents"];
    }

    const missingDocumentBuckets = documentBucketIds.filter((bucketId) => !knownBucketIds.has(bucketId));
    if (missingDocumentBuckets.length > 0) {
      notes.push(
        `Buckets in SUPABASE_DOCUMENT_BUCKET_IDS not found: ${missingDocumentBuckets.join(", ")}.`,
      );
    }

    let documentsUsedBytes = 0;
    let documentsObjectCount = 0;

    if (documentBucketIds.length === 0) {
      documentsUsedBytes = storageSnapshot.totalUsedBytes;
      documentsObjectCount = storageSnapshot.scannedObjects;
      notes.push(
        "SUPABASE_DOCUMENT_BUCKET_IDS is not configured. Documents usage currently uses total storage usage.",
      );
    } else {
      for (const bucketId of documentBucketIds) {
        const usage = storageSnapshot.usageByBucket.get(bucketId);

        if (usage) {
          documentsUsedBytes += usage.usedBytes;
          documentsObjectCount += usage.objectCount;
        }
      }
    }

    if (storageAvailable && storageSnapshot.scanTruncated) {
      notes.push(
        `Storage usage scanned ${storageSnapshot.scannedObjects} objects of ${storageSnapshot.totalObjects}. Increase SUPABASE_USAGE_MAX_SCANNED_OBJECTS for full precision.`,
      );
    }

    if (databaseUsedBytes === null) {
      notes.push(
        "Database size bytes are not available yet. Run the migration that adds public.admin_database_size_bytes().",
      );
    }

    const response: SupabaseUsageResponse = {
      generatedAt: new Date().toISOString(),
      plan: {
        name: configuredPlanName ?? "Not configured",
        source: configuredPlanName ? "env" : "unknown",
      },
      quotas: {
        database: buildQuotaMetric(databaseUsedBytes, databaseLimitBytes),
        storage: buildQuotaMetric(storageAvailable ? storageSnapshot.totalUsedBytes : null, storageLimitBytes),
      },
      records: {
        profiles: profilesCount,
        documents: documentsCount,
        problemSolverSessions: problemSolverSessionsCount,
        userFeedback: userFeedbackCount,
        total:
          profilesCount + documentsCount + problemSolverSessionsCount + userFeedbackCount,
      },
      storage: {
        totalBuckets: storageBuckets.length,
        totalObjects: storageSnapshot.totalObjects,
        scannedObjects: storageSnapshot.scannedObjects,
        scanTruncated: storageSnapshot.scanTruncated,
        totalUsedBytes: storageSnapshot.totalUsedBytes,
        documentsUsedBytes,
        documentsObjectCount,
        documentBucketIds,
        topBuckets: buildTopBuckets(
          storageSnapshot.usageByBucket,
          bucketNameMap,
          storageSnapshot.totalUsedBytes,
          topBucketCount,
        ),
      },
      notes,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = extractErrorMessage(error, "Unable to load Supabase usage metrics.");
    console.error("[api/admin/supabase-usage] fatal error:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
