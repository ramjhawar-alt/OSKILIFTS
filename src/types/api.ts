export type WeightRoomHours = {
  label: string;
  open: string;
  close: string;
};

export type WeightRoomStatus = {
  occupancy: number;
  capacity: number | null;
  percent: number | null;
  status: string;
  message: string;
  updatedAt: string;
  isOpen: boolean;
  hours: WeightRoomHours[];
};

export type ClassSession = {
  id?: string;
  name: string;
  category: string;
  instructor: string;
  startTimeLocal: string | null;
  endTimeLocal: string | null;
  timeZone: string;
  location: string;
  description: string;
  isCancelled: boolean;
};

export type ClassDay = {
  date: string;
  label: string;
  sessions: ClassSession[];
};

export type ClassScheduleResponse = {
  startDate: string;
  days: ClassDay[];
};

