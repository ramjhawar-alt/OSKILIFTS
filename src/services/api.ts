import type {
  WeightRoomStatus,
  ClassScheduleResponse,
} from '../types/api';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_OSKILIFTS_API_URL || 'http://localhost:4000';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  return response.json() as Promise<T>;
}

export async function fetchWeightRoomStatus(): Promise<WeightRoomStatus> {
  const response = await fetch(`${API_BASE_URL}/api/weightroom`);
  return handleResponse<WeightRoomStatus>(response);
}

export async function fetchClassSchedule(
  startDate?: string,
): Promise<ClassScheduleResponse> {
  const url = new URL(`${API_BASE_URL}/api/classes`);
  if (startDate) {
    url.searchParams.set('startDate', startDate);
  }
  const response = await fetch(url.toString());
  return handleResponse<ClassScheduleResponse>(response);
}

