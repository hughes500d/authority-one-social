module.exports = function (api) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- babel's api is untyped (any); this is the standard babel config entrypoint
  api.cache(true)
  const isTestEnv = process.env.NODE_ENV === 'test'
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          lazyImports: true,
          native: {
            // Disable ESM -> CJS compilation because Metro takes care of it.
            // However, we need it in Jest tests since those run without Metro.
            disableImportExportTransform: !isTestEnv,
          },
        },
      ],
    ],
    plugins: [
      // stripMessageField:false keeps the English source text in the bundle in ALL
      // environments (the default strips it in production). Without it, any string
      // missing from the compiled catalog renders as its raw hash id in Release builds
      // instead of degrading to English. Small bundle-size cost; prevents the
      // "garbled labels on TestFlight" class of bug from recurring.
      ['@lingui/babel-plugin-lingui-macro', {stripMessageField: false}],
      ['babel-plugin-react-compiler', {target: '19'}],
      [
        'module:react-native-dotenv',
        {
          envName: 'APP_ENV',
          moduleName: '@env',
          path: '.env',
          blocklist: null,
          allowlist: null,
          safe: false,
          allowUndefined: true,
          verbose: false,
        },
      ],
      [
        'module-resolver',
        {
          alias: {
            // This needs to be mirrored in tsconfig.json
            '#': './src',
            crypto: './src/platform/crypto.ts',
          },
        },
      ],
      'react-native-reanimated/plugin', // NOTE: this plugin MUST be last
    ],
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
      test: {
        plugins: ['@babel/plugin-transform-class-static-block'],
      },
    },
  }
}
