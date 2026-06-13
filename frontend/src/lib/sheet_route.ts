export type SheetRoute =
  | {
      view: "character";
      characterIndex: number;
    }
  | {
      view: "darkConspiracy";
    };

const characterRoutePattern = /^\/characters\/(\d+)\/?$/;

export const parseSheetRoute = (pathname: string, fallbackCharacterIndex: number): SheetRoute => {
  if (pathname === "/dark-conspiracy") {
    return { view: "darkConspiracy" };
  }

  const characterMatch = pathname.match(characterRoutePattern);
  if (characterMatch) {
    const routeIndex = Number.parseInt(characterMatch[1], 10) - 1;
    if (Number.isFinite(routeIndex) && routeIndex >= 0) {
      return { view: "character", characterIndex: routeIndex };
    }
  }

  return { view: "character", characterIndex: fallbackCharacterIndex };
};

export const getSheetRoutePath = (route: SheetRoute): string => {
  if (route.view === "darkConspiracy") {
    return "/dark-conspiracy";
  }

  return `/characters/${route.characterIndex + 1}`;
};
