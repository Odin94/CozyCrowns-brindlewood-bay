type AnalyticsClient = {
  identify: (id: string, properties: Record<string, unknown>) => unknown;
  reset: () => unknown;
};
type AnalyticsUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};
type ClientLoader = () => Promise<AnalyticsClient | undefined>;
type ErrorHandler = (error: unknown) => void;

/** An effect's cleanup invalidates identity work while the SDK is loading. */
export const identifyAnalyticsUser = (
  load: ClientLoader,
  user: AnalyticsUser,
  onError: ErrorHandler,
) => {
  let cancelled = false;
  void load()
    .then((client) => {
      if (!cancelled)
        client?.identify(user.id, {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
    })
    .catch(onError);
  return () => {
    cancelled = true;
  };
};

/** Preserve identity reset ordering even if logout finishes before SDK loading. */
export const resetAnalyticsAndNavigate = async (
  load: ClientLoader,
  navigate: () => void,
  onError: ErrorHandler,
  shouldProceed: () => boolean = () => true,
) => {
  try {
    const client = await load();
    if (shouldProceed()) client?.reset();
  } catch (error) {
    onError(error);
  } finally {
    if (shouldProceed()) navigate();
  }
};
