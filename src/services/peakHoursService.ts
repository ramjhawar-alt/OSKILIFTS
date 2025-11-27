export interface PeakHoursData {
  hasData: boolean;
  busiest?: string;
  bestTime?: string;
  message?: string;
}

/**
 * Get peak hours information for the RSF weight room
 * Currently returns placeholder data until historical data collection is implemented
 */
export function getPeakHours(): PeakHoursData {
  return {
    hasData: false,
    message: "Peak hours insights coming soon! We're collecting data to show you the best times to hit the RSF.",
  };
}

