/**
 * Android packaging, which depends on what the build is *for*.
 *
 * The settings that make a directly-installed APK small are the same settings
 * that make a Play Store AAB worse, so they cannot both live in `app.json`:
 *
 * - **Directly installed** (the APK sent to a phone over a link). Everything
 *   any device might need is in the one file, so the file carries whatever is
 *   not stripped out here: four ABIs where a phone runs one, and libraries
 *   stored uncompressed because Play would otherwise have compressed them.
 * - **Play Store** (`production`, an AAB). Play splits the bundle per device
 *   and compresses on the way down, so the upload keeps every ABI and leaves
 *   compression off — doing it here would shrink nothing and cost startup.
 *
 * `EAS_BUILD_PROFILE` is set by EAS on its builders. Locally it is unset, and
 * a local build is one going straight onto a handset, which is why unset means
 * the APK settings rather than the store ones.
 */
const isPlayStoreBundle = process.env.EAS_BUILD_PROFILE === 'production';

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...config.plugins,
    [
      'expo-build-properties',
      {
        android: isPlayStoreBundle
          ? { useLegacyPackaging: false, enableBundleCompression: false }
          : {
              // One ABI instead of four. `x86`/`x86_64` are emulator-only and
              // every 64-bit handset runs `arm64-v8a`; building for an x86
              // emulator means building the `production` profile or adding the
              // ABI back here.
              buildArchs: ['arm64-v8a'],
              // Compress the native libraries. Larger on disk once installed,
              // much smaller to send.
              useLegacyPackaging: true,
              // Compress the JS bundle. Costs some cold-start time, because a
              // compressed bundle is extracted where an uncompressed one is
              // mapped straight into memory. Flip to `false` to trade the
              // ~3.5MB back for the startup.
              enableBundleCompression: true,
            },
      },
    ],
  ],
});
