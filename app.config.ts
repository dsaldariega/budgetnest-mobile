import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME?.trim();
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON?.trim() || "./google-services.json";

  const plugins = (config.plugins ?? []).filter(
    (plugin) =>
      plugin !== "react-native-nitro-google-signin" && plugin !== "expo-sharing",
  );

  plugins.push("expo-sharing");

  if (iosUrlScheme) {
    plugins.push([
      "react-native-nitro-google-signin",
      {
        iosUrlScheme,
        androidGoogleServicesFile: googleServicesFile,
      },
    ]);
  } else {
    plugins.push([
      "react-native-nitro-google-signin",
      {
        androidGoogleServicesFile: googleServicesFile,
      },
    ]);
  }

  return {
    ...config,
    name: config.name ?? "BudgetNest",
    slug: config.slug ?? "budgetnest-mobile",
    version: config.version ?? "1.0.0",
    android: {
      ...config.android,
      googleServicesFile,
    },
    plugins,
  };
};
