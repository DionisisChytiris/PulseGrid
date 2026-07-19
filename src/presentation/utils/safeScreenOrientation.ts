/**
 * Best-effort orientation helpers.
 * Swallows missing-native-module errors so UI screens still mount
 * when the installed binary predates expo-screen-orientation.
 */

type OrientationModule = typeof import('expo-screen-orientation');

async function loadOrientation(): Promise<OrientationModule | null> {
  try {
    return await import('expo-screen-orientation');
  } catch {
    return null;
  }
}

export async function lockPortraitUpSafe(): Promise<void> {
  const ScreenOrientation = await loadOrientation();
  if (ScreenOrientation === null) {
    return;
  }

  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    // Ignore unsupported / unavailable locks.
  }
}

export async function lockLandscapeSafe(): Promise<void> {
  const ScreenOrientation = await loadOrientation();
  if (ScreenOrientation === null) {
    return;
  }

  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  } catch {
    // Ignore unsupported / unavailable locks.
  }
}

export async function unlockOrientationSafe(): Promise<void> {
  const ScreenOrientation = await loadOrientation();
  if (ScreenOrientation === null) {
    return;
  }

  try {
    await ScreenOrientation.unlockAsync();
  } catch {
    // Ignore unsupported / unavailable unlock.
  }
}
