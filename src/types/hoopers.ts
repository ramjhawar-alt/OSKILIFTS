export type HoopersStatus = 'Not Crowded' | 'Moderate' | 'Very Crowded';

export interface HoopersData {
  count: number;
  status: HoopersStatus;
}

export interface CheckInResponse {
  success: boolean;
  userId: string;
  checkedInAt: number;
  count: number;
  status: HoopersStatus;
}

export interface CheckOutResponse {
  success: boolean;
  wasCheckedIn: boolean;
  count: number;
  status: HoopersStatus;
}

export interface CheckInStatusResponse {
  checkedIn: boolean;
}

