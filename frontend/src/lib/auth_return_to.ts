const authReturnToStorageKey = "cozycrowns-auth-return-to";

export const isSafeAuthReturnTo = (value: string | null): value is string =>
  !!value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");

export const rememberAuthReturnTo = (returnTo: string) => {
  if (isSafeAuthReturnTo(returnTo)) {
    window.sessionStorage.setItem(authReturnToStorageKey, returnTo);
  }
};

export const consumeAuthReturnTo = () => {
  const returnTo = window.sessionStorage.getItem(authReturnToStorageKey);
  window.sessionStorage.removeItem(authReturnToStorageKey);
  return isSafeAuthReturnTo(returnTo) ? returnTo : "/";
};

export const clearAuthReturnTo = () => {
  window.sessionStorage.removeItem(authReturnToStorageKey);
};
