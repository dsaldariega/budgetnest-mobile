import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME?.trim();

  const plugins = (config.plugins ?? []).filter(
    (plugin) => plugin !== "react-native-nitro-google-signin",
  );

  if (iosUrlScheme) {
    plugins.push([
      "react-native-nitro-google-signin",
      {
        iosUrlScheme,
      },
    ]);
  }

  return {
    ...config,
    name: config.name ?? "BudgetNest",
    slug: config.slug ?? "budgetnest-mobile",
    version: config.version ?? "1.0.0",
    plugins,
  };
};
