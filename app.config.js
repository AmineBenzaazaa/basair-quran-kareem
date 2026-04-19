const appConfig = require("./app.json");

module.exports = () => ({
  ...appConfig,
  expo: {
    ...appConfig.expo,
    extra: {
      ...(appConfig.expo.extra ?? {}),
      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL ??
        process.env.VITE_SUPABASE_URL ??
        process.env.SUPABASE_URL ??
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        "",
      supabasePublishableKey:
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
        process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
        process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
        "",
    },
  },
});
