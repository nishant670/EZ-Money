const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAndroidStyles,
  withDangerousMod,
  withMainApplication,
  withStringsXml,
} = require('expo/config-plugins');

const PLUGIN_ROOT = path.join(__dirname, 'finnri-android-capture');
const WIDGET_PACKAGE_LINE = 'add(FinnriWidgetPackage())';

const replaceNamedEntry = (entries, name, value) => [
  ...(entries ?? []).filter((entry) => entry?.$?.['android:name'] !== name),
  value,
];

const withCaptureManifest = (config) =>
  withAndroidManifest(config, (nextConfig) => {
    const application = nextConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error('Finnri capture plugin could not find Android application.');

    application.activity = replaceNamedEntry(application.activity, '.FinnriCaptureActivity', {
      $: {
        'android:name': '.FinnriCaptureActivity',
        'android:exported': 'false',
        'android:excludeFromRecents': 'true',
        'android:theme': '@style/FinnriCaptureTheme',
        'android:screenOrientation': 'portrait',
      },
    });
    application.service = replaceNamedEntry(application.service, '.CaptureTileService', {
      $: {
        'android:name': '.CaptureTileService',
        'android:exported': 'true',
        'android:label': '@string/capture_tile_label',
        'android:icon': '@drawable/ic_mic_widget',
        'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
      },
      'intent-filter': [
        { action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }] },
      ],
    });
    application.receiver = replaceNamedEntry(application.receiver, '.FinnriWidgetProvider', {
      $: { 'android:name': '.FinnriWidgetProvider', 'android:exported': 'false' },
      'intent-filter': [
        { action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/finnri_widget_info',
          },
        },
      ],
    });
    return nextConfig;
  });

const withCaptureStrings = (config) =>
  withStringsXml(config, (nextConfig) => {
    const values = {
      capture_tile_label: 'Capture expense',
      widget_description: 'Month-to-date spending and quick voice capture',
      widget_month_default: 'This month',
      widget_amount_default: 'Open Finnri to refresh',
    };
    const names = new Set(Object.keys(values));
    const strings = (nextConfig.modResults.resources.string ?? []).filter(
      (entry) => !names.has(entry?.$?.name)
    );
    nextConfig.modResults.resources.string = [
      ...strings,
      ...Object.entries(values).map(([name, value]) => ({ $: { name }, _: value })),
    ];
    return nextConfig;
  });

const withCaptureStyle = (config) =>
  withAndroidStyles(config, (nextConfig) => {
    const styles = (nextConfig.modResults.resources.style ?? []).filter(
      (style) => style?.$?.name !== 'FinnriCaptureTheme'
    );
    styles.push({
      $: { name: 'FinnriCaptureTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' },
      // Colours come from `res/values/finnri_capture_colors.xml`, which the
      // resource copy below drops into the same `values/` folder. `colorAccent`
      // is what tints AppCompat widgets, so leaving it off-palette here is what
      // made the capture button render purple no matter what the view set.
      item: [
        { $: { name: 'android:windowBackground' }, _: '@color/finnri_background' },
        { $: { name: 'android:colorAccent' }, _: '@color/finnri_accent' },
        { $: { name: 'android:windowLightStatusBar' }, _: 'false' },
        { $: { name: 'android:statusBarColor' }, _: '@color/finnri_background' },
        { $: { name: 'android:navigationBarColor' }, _: '@color/finnri_background' },
      ],
    });
    nextConfig.modResults.resources.style = styles;
    return nextConfig;
  });

const withWidgetPackage = (config) =>
  withMainApplication(config, (nextConfig) => {
    const mainApplication = nextConfig.modResults;
    if (mainApplication.language !== 'kt') {
      throw new Error('Finnri capture plugin currently requires a Kotlin MainApplication.');
    }
    if (!mainApplication.contents.includes(WIDGET_PACKAGE_LINE)) {
      const marker = /PackageList\(this\)\.packages\.apply \{\s*\n/;
      if (!marker.test(mainApplication.contents)) {
        throw new Error('Finnri capture plugin could not register its React Native package.');
      }
      mainApplication.contents = mainApplication.contents.replace(
        marker,
        (match) => `${match}          ${WIDGET_PACKAGE_LINE}\n`
      );
    }
    return nextConfig;
  });

const copyTree = (source, destination, transform) => {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyTree(sourcePath, destinationPath, transform);
      continue;
    }
    const content = fs.readFileSync(sourcePath);
    fs.writeFileSync(destinationPath, transform ? transform(content.toString('utf8')) : content);
  }
};

const withCaptureSources = (config) =>
  withDangerousMod(config, [
    'android',
    (nextConfig) => {
      const androidRoot = nextConfig.modRequest.platformProjectRoot;
      const packageName = nextConfig.android?.package ?? 'com.finnri.app';
      const packagePath = packageName.split('.').join(path.sep);
      copyTree(
        path.join(PLUGIN_ROOT, 'java', 'com', 'finnri', 'app'),
        path.join(androidRoot, 'app', 'src', 'main', 'java', packagePath),
        (content) => content.replace(/^package com\.finnri\.app/m, `package ${packageName}`)
      );
      copyTree(
        path.join(PLUGIN_ROOT, 'res'),
        path.join(androidRoot, 'app', 'src', 'main', 'res')
      );
      return nextConfig;
    },
  ]);

module.exports = function withFinnriAndroidCapture(config) {
  config = withCaptureManifest(config);
  config = withCaptureStrings(config);
  config = withCaptureStyle(config);
  config = withWidgetPackage(config);
  return withCaptureSources(config);
};
