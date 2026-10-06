/** Login/logout replace the session identity. Verified renewal keeps it stable. */
export function createTokenStorage(storage: Storage) {
  const tokenKey = "auth_token";
  const epochKey = "auth_session_epoch";
  const sessionKey = () => {
    let epoch = storage.getItem(epochKey);
    if (!epoch) {
      epoch = crypto.randomUUID();
      storage.setItem(epochKey, epoch);
    }
    return epoch;
  };
  return {
    get: () => storage.getItem(tokenKey),
    sessionKey,
    set: (token: string) => {
      storage.setItem(epochKey, crypto.randomUUID());
      storage.setItem(tokenKey, token);
    },
    remove: () => {
      storage.setItem(epochKey, crypto.randomUUID());
      storage.removeItem(tokenKey);
    },
    rotate: (token: string, expectedToken: string | null, expectedEpoch: string) => {
      if (
        !expectedToken ||
        storage.getItem(tokenKey) !== expectedToken ||
        sessionKey() !== expectedEpoch
      )
        return false;
      storage.setItem(tokenKey, token);
      return true;
    },
  };
}
