import config from "../vite.config";
export default {
  ...config,
  cacheDir: "/tmp/cozycrowns-allviews-after-vite-cache",
  server: { hmr: false },
};
