import {
  friendlyModerationError,
  type AdminReport,
  type ReportStatus,
  type ReportTarget,
  type ResolveAction,
} from '../domain/moderation';
import { supabase } from './supabaseClient';

/** Whether I'm an admin, and how many reports are open. Never throws; non-admins get { false, 0 }. */
export async function getAdminStatus(): Promise<{ isAdmin: boolean; openCount: number }> {
  try {
    const { data: isAdmin, error } = await supabase.rpc('am_i_admin');
    if (error || isAdmin !== true) return { isAdmin: false, openCount: 0 };
    const { data: count } = await supabase.rpc('admin_open_report_count');
    return { isAdmin: true, openCount: Number(count ?? 0) };
  } catch {
    return { isAdmin: false, openCount: 0 };
  }
}

export async function listReports(status: 'open' | 'resolved'): Promise<AdminReport[]> {
  const { data, error } = await supabase.rpc('admin_list_reports', { p_status: status, p_limit: 50 });
  if (error) throw new Error(friendlyModerationError(error.message));
  return (data ?? []).map(
    (row: {
      id: string;
      target_type: ReportTarget;
      target_id: string;
      reason: string;
      details: string | null;
      status: ReportStatus;
      created_at: string;
      reporter_username: string | null;
      reported_user_id: string | null;
      reported_username: string | null;
      snapshot: unknown;
      reports_against_user: number;
      target_exists: boolean;
    }) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.created_at,
      reporterUsername: row.reporter_username,
      reportedUserId: row.reported_user_id,
      reportedUsername: row.reported_username,
      snapshot: row.snapshot,
      reportsAgainstUser: Number(row.reports_against_user),
      targetExists: row.target_exists === true,
    }),
  );
}

export async function resolveReport(reportId: string, action: ResolveAction): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_report', { p_report: reportId, p_action: action });
  if (error) throw new Error(friendlyModerationError(error.message));
}
