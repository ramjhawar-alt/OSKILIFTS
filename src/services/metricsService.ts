import { friendlyMetricsError, parseMetrics, type AdminMetrics } from '../domain/metrics';
import { supabase } from './supabaseClient';

/** Admin only. The database refuses everyone else, so a non-admin just gets an error. */
export async function getAdminMetrics(days: number): Promise<AdminMetrics> {
  const { data, error } = await supabase.rpc('admin_metrics', { p_days: days });
  if (error) throw new Error(friendlyMetricsError(error.message));
  return parseMetrics(data);
}
