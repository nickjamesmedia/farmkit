import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';

type Props = { session: Session };

type TableResult = {
  table: string;
  rows: Record<string, any>[];
  error?: string;
};

type AuditRow = {
  table: string;
  id: string;
  farmId?: string;
  farmName?: string;
  personName?: string;
  timestamp?: string;
  data: Record<string, any>;
};

const TABLES = [
  'roles',
  'modules',
  'farms',
  'farm_details',
  'farm_erp',
  'user_profiles',
  'farm_memberships',
  'people',
  'farm_modules',
  'containers',
  'building_details',
  'equipment',
  'maintenance_logs',
];

const MAX_ROWS_PER_TABLE = 200;

const pickId = (row: Record<string, any>) =>
  row.id ??
  row.farm_id ??
  row.container_id ??
  row.auth_user_id ??
  row.module_id ??
  row.role_id;

const pickTimestamp = (row: Record<string, any>) =>
  row.created_at ?? row.logged_at ?? row.updated_at ?? row.enabled_at ?? row.last_seen_at;

function RlsAudit({ session }: Props) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<TableResult[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const fetched = await Promise.all(
        TABLES.map(async (table) => {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(MAX_ROWS_PER_TABLE);
          return {
            table,
            rows: (data ?? []) as Record<string, any>[],
            error: error?.message,
          };
        }),
      );
      if (!active) return;
      setResults(fetched);
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const auditRows = useMemo(() => {
    const farmNameById: Record<string, string> = {};
    const personNameById: Record<string, string> = {};

    const farmRows = results.find((result) => result.table === 'farms')?.rows ?? [];
    farmRows.forEach((row) => {
      if (row.id && row.name) {
        farmNameById[String(row.id)] = String(row.name);
      }
    });

    const peopleRows =
      results.find((result) => result.table === 'people')?.rows ?? [];
    peopleRows.forEach((row) => {
      const label =
        row.display_name ||
        [row.first_name, row.last_name].filter(Boolean).join(' ');
      if (row.id && label) {
        personNameById[String(row.id)] = String(label);
      }
    });

    const rows = results.flatMap((result) =>
      result.rows.map((row) => {
        const idValue = pickId(row);
        const timestampValue = pickTimestamp(row);
        const farmId = row.farm_id ? String(row.farm_id) : undefined;
        const farmName =
          result.table === 'farms'
            ? row.name
              ? String(row.name)
              : undefined
            : farmId
              ? farmNameById[farmId]
              : undefined;
        const personId = row.entered_by_person_id ?? row.person_id;
        const personName = personId
          ? personNameById[String(personId)]
          : undefined;
        return {
          table: result.table,
          id: idValue ? String(idValue) : '-',
          farmId,
          farmName,
          personName,
          timestamp: timestampValue ? String(timestampValue) : undefined,
          data: row,
        } as AuditRow;
      }),
    );
    const toTime = (value?: string) => (value ? Date.parse(value) : 0);
    return rows.sort((a, b) => toTime(b.timestamp) - toTime(a.timestamp));
  }, [results]);

  const errors = results.filter((result) => result.error);

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="RLS Audit" />
      <div className="app">
        <div className="card stack">
          <div className="stack">
            <h1>RLS Audit</h1>
            <p>
              Dev-only view of records visible to your account. Showing up to{' '}
              {MAX_ROWS_PER_TABLE} rows per table.
            </p>
          </div>
          {loading && <p>Loading...</p>}
          {!loading && errors.length > 0 && (
            <div className="status">
              <strong>Table errors:</strong>
              <ul>
                {errors.map((result) => (
                  <li key={result.table}>
                    {result.table}: {result.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!loading && (
            <div className="audit-meta">
              {results.map((result) => (
                <span key={result.table} className="audit-pill">
                  {result.table}: {result.rows.length}
                </span>
              ))}
            </div>
          )}
          {!loading && auditRows.length === 0 && <p>No records visible.</p>}
          {!loading && auditRows.length > 0 && (
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Record</th>
                  <th>Farm</th>
                  <th>Person</th>
                  <th>Timestamp</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row, index) => (
                  <tr key={`${row.table}-${row.id}-${index}`}>
                    <td>{row.table}</td>
                    <td>{row.id}</td>
                    <td>{row.farmName ?? row.farmId ?? '-'}</td>
                    <td>{row.personName ?? '-'}</td>
                    <td>{row.timestamp ?? '-'}</td>
                    <td>
                      <pre className="audit-json">
                        {JSON.stringify(row.data, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export default RlsAudit;
