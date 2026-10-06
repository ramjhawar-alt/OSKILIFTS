// Tiny module with no imports so workoutStorage can invalidate the history
// cache without an import cycle (historyCache imports workoutStorage).
let version = 0;
export const bumpHistoryVersion = (): void => {
  version += 1;
};
export const currentHistoryVersion = (): number => version;
