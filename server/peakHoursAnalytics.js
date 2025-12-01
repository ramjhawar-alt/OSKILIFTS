const { getCapacityData } = require('./dataCollectionService');

/**
 * Analyze capacity data to determine peak hours
 * @returns {Object} Peak hours analysis result
 */
function analyzePeakHours() {
  const data = getCapacityData();

  if (data.length === 0) {
    return {
      hasData: false,
      message: "We're collecting data! Check back in a few days to see peak hours.",
      totalSamples: 0,
    };
  }

  // Need at least 50 samples to provide meaningful insights
  if (data.length < 50) {
    return {
      hasData: false,
      message: `We're collecting data! (${data.length} samples so far). Check back in a few days to see peak hours.`,
      totalSamples: data.length,
    };
  }

  // Group data by hour of day
  const hourlyData = {};
  const dayOfWeekData = {};

  data.forEach((entry) => {
    if (!entry.isOpen) return; // Skip closed hours

    const hour = entry.hour;
    const day = entry.dayOfWeek;
    const percentage = entry.percentage || entry.currentCount / entry.maxCapacity;

    // Group by hour
    if (!hourlyData[hour]) {
      hourlyData[hour] = [];
    }
    hourlyData[hour].push(percentage);

    // Group by day of week
    if (!dayOfWeekData[day]) {
      dayOfWeekData[day] = [];
    }
    dayOfWeekData[day].push(percentage);
  });

  // Calculate average capacity for each hour
  const hourlyAverages = {};
  Object.keys(hourlyData).forEach((hour) => {
    const samples = hourlyData[hour];
    const avg =
      samples.reduce((sum, val) => sum + val, 0) / samples.length;
    hourlyAverages[parseInt(hour)] = avg;
  });

  // Find busiest hour
  let busiestHour = null;
  let busiestAvg = 0;
  Object.keys(hourlyAverages).forEach((hour) => {
    if (hourlyAverages[hour] > busiestAvg) {
      busiestAvg = hourlyAverages[hour];
      busiestHour = parseInt(hour);
    }
  });

  // Find least busy hour (best time to go)
  let bestHour = null;
  let bestAvg = 1;
  Object.keys(hourlyAverages).forEach((hour) => {
    if (hourlyAverages[hour] < bestAvg && hourlyAverages[hour] > 0) {
      bestAvg = hourlyAverages[hour];
      bestHour = parseInt(hour);
    }
  });

  // Format hours for display
  const formatHour = (hour) => {
    if (hour === null || hour === undefined) return 'N/A';
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  // Calculate average capacity percentage for busiest/best times
  const busiestPercent = busiestHour !== null
    ? Math.round(hourlyAverages[busiestHour] * 100)
    : null;
  const bestPercent = bestHour !== null
    ? Math.round(hourlyAverages[bestHour] * 100)
    : null;

  // Determine day of week patterns
  const dayAverages = {};
  Object.keys(dayOfWeekData).forEach((day) => {
    const samples = dayOfWeekData[day];
    const avg =
      samples.reduce((sum, val) => sum + val, 0) / samples.length;
    dayAverages[parseInt(day)] = avg;
  });

  // Find busiest day
  let busiestDay = null;
  let busiestDayAvg = 0;
  Object.keys(dayAverages).forEach((day) => {
    if (dayAverages[day] > busiestDayAvg) {
      busiestDayAvg = dayAverages[day];
      busiestDay = parseInt(day);
    }
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const busiestDayName = busiestDay !== null ? dayNames[busiestDay] : null;

  return {
    hasData: true,
    busiest: busiestHour !== null
      ? `${formatHour(busiestHour)} (avg ${busiestPercent}% full)`
      : 'N/A',
    bestTime: bestHour !== null
      ? `${formatHour(bestHour)} (avg ${bestPercent}% full)`
      : 'N/A',
    busiestDay: busiestDayName,
    totalSamples: data.length,
    dataRange: {
      oldest: data[0]?.timestamp,
      newest: data[data.length - 1]?.timestamp,
    },
  };
}

module.exports = {
  analyzePeakHours,
};

