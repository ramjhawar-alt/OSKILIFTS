const {
  getCapacitySnapshotsForAnalytics,
} = require('./dataCollectionService');
const { analyzePeakHours } = require('./peakHoursAnalytics');

(async () => {
  console.log('Analyzing RSF capacity data\n');

  const data = await getCapacitySnapshotsForAnalytics(90);
  console.log(`Total data points: ${data.length}\n`);

  if (data.length === 0) {
    console.log('No data collected yet.');
    console.log(
      'Ensure SUPABASE_* env vars are set on the server and the migration has been applied.\n',
    );
    process.exit(0);
  }

  const oldest = new Date(data[0].timestamp);
  const newest = new Date(data[data.length - 1].timestamp);
  console.log('Date range:');
  console.log(`   Oldest: ${oldest.toLocaleString()}`);
  console.log(`   Newest: ${newest.toLocaleString()}\n`);

  console.log('Peak hours analysis:\n');
  const analysis = await analyzePeakHours();
  console.log(JSON.stringify(analysis, null, 2));
  console.log('\n');

  console.log('Hourly breakdown (last 100 samples):\n');
  const recentData = data.slice(-100);
  const hourlyCount = {};
  recentData.forEach((entry) => {
    const hour = entry.hour;
    if (!hourlyCount[hour]) {
      hourlyCount[hour] = { count: 0, total: 0 };
    }
    hourlyCount[hour].count += 1;
    hourlyCount[hour].total += entry.currentCount;
  });

  Object.keys(hourlyCount)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .forEach((hour) => {
      const avg = Math.round(hourlyCount[hour].total / hourlyCount[hour].count);
      const h = parseInt(hour, 10);
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      console.log(
        `   ${displayHour}:00 ${period} - Avg: ${avg} people (${hourlyCount[hour].count} samples)`,
      );
    });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
