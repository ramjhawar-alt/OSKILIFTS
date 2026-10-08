import { createNavigationContainerRef } from '@react-navigation/native';

/** Lets code outside any screen (like the invite handler) navigate once the app is ready. */
export const navigationRef = createNavigationContainerRef<any>();

/** Waits (briefly) for the navigator to mount, then runs `action`. Resolves false if it never did. */
export async function whenNavigationReady(action: () => void, timeoutMs = 6000): Promise<boolean> {
  const started = Date.now();
  while (!navigationRef.isReady()) {
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  action();
  return true;
}
