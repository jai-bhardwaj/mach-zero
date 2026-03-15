// QuestDB REST API query helper
// QuestDB HTTP endpoint: http://localhost:9000/exec?query=...

import 'server-only';

const QUESTDB_URL = process.env.QUESTDB_URL ?? "http://localhost:9000";

interface QuestDBResponse {
  columns: { name: string; type: string }[];
  dataset: unknown[][];
  count: number;
  query: string;
}

export async function queryQuestDB(sql: string): Promise<QuestDBResponse> {
  const url = `${QUESTDB_URL}/exec?query=${encodeURIComponent(sql)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`QuestDB query failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Convert QuestDB dataset rows into objects keyed by column name
export function rowsToObjects<T>(response: QuestDBResponse): T[] {
  const { columns, dataset } = response;
  return dataset.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col.name] = row[i];
    });
    return obj as T;
  });
}

// Build validated ORDER BY clause from sort params
export function buildOrderBy(
  sortColumn: string | null,
  sortDir: string | null,
  allowedColumns: string[],
  defaultOrderBy = "timestamp DESC"
): string {
  if (!sortColumn || !allowedColumns.includes(sortColumn)) return defaultOrderBy;
  const dir = sortDir?.toUpperCase() === "ASC" ? "ASC" : "DESC";
  return `${sortColumn} ${dir}`;
}

// Paginated query helper — runs data + COUNT queries in parallel
export async function queryPaginated<T>(
  table: string,
  conditions: string[],
  limit: number,
  offset: number,
  orderBy = "timestamp DESC"
): Promise<{ data: T[]; total: number; offset: number; limit: number }> {
  const where =
    conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

  const [dataResult, countResult] = await Promise.all([
    queryQuestDB(
      `SELECT * FROM ${table}${where} ORDER BY ${orderBy} LIMIT ${offset}, ${offset + limit}`
    ),
    queryQuestDB(`SELECT COUNT(*) as total FROM ${table}${where}`),
  ]);

  const data = rowsToObjects<T>(dataResult);
  const total = Number(countResult.dataset[0]?.[0] ?? 0);
  return { data, total, offset, limit };
}
