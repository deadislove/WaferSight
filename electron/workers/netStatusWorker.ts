let lastOnlineStatus: boolean | null = null;

export function createNetStatusTask(onStatusChange: (isOnline: boolean) => void) {
  return ({ hasInternet }: { hasInternet: boolean }) => {
    if (hasInternet !== lastOnlineStatus) {
      lastOnlineStatus = hasInternet;
      onStatusChange(hasInternet);
    }
  };
}
