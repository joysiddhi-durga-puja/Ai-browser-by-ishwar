const { withAndroidManifest, withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withBackgroundAudioGradleDeps(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('androidx.media:media')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation("androidx.media:media:1.7.0")`
      );
    }
    return config;
  });
}

function withBackgroundAudioManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    const perms = manifest.manifest['uses-permission'] || [];
    const needed = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.WAKE_LOCK',
      'android.permission.POST_NOTIFICATIONS',
    ];
    needed.forEach((name) => {
      if (!perms.find((p) => p.$['android:name'] === name)) {
        perms.push({ $: { 'android:name': name } });
      }
    });
    manifest.manifest['uses-permission'] = perms;

    if (!app.service) app.service = [];
    const pkg = config.android.package;
    const serviceName = `${pkg}.BackgroundAudioService`;
    if (!app.service.find((s) => s.$['android:name'] === serviceName)) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:foregroundServiceType': 'mediaPlayback',
          'android:exported': 'false',
        },
      });
    }
    return config;
  });
}

function withBackgroundAudioNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const pkg = config.android.package;
      const pkgPath = pkg.replace(/\./g, '/');
      const javaDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java',
        pkgPath
      );
      fs.mkdirSync(javaDir, { recursive: true });

      const templatesDir = path.join(config.modRequest.projectRoot, 'plugins/templates');
      const files = [
        'BackgroundAudioService.kt',
        'BackgroundAudioModule.kt',
        'BackgroundAudioPackage.kt',
      ];
      files.forEach((file) => {
        let content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        content = content.replace(/__PACKAGE__/g, pkg);
        fs.writeFileSync(path.join(javaDir, file), content);
      });

      // Best-effort auto-registration in MainApplication. If this regex
      // doesn't match your generated file (varies by Expo/RN version),
      // add the line manually — see README note printed below.
      const candidates = ['MainApplication.kt', 'MainApplication.java'];
      let registered = false;
      for (const name of candidates) {
        const p = path.join(javaDir, name);
        if (!fs.existsSync(p)) continue;
        let src = fs.readFileSync(p, 'utf8');
        if (src.includes('BackgroundAudioPackage')) { registered = true; break; }
        const patched = src.replace(
          /(return\s+packages\s*\n?\s*})/,
          `  packages.add(BackgroundAudioPackage())\n  $1`
        );
        if (patched !== src) {
          fs.writeFileSync(p, patched);
          registered = true;
        }
        break;
      }
      if (!registered) {
        console.warn(
          '[withBackgroundAudio] Could not auto-register BackgroundAudioPackage in MainApplication. ' +
          'Open android/app/src/main/java/.../MainApplication.kt (or .java) and add ' +
          '`packages.add(BackgroundAudioPackage())` inside the function that returns the packages list.'
        );
      }

      return config;
    },
  ]);
}

module.exports = function withBackgroundAudio(config) {
  config = withBackgroundAudioManifest(config);
  config = withBackgroundAudioGradleDeps(config);
  config = withBackgroundAudioNativeFiles(config);
  return config;
};
