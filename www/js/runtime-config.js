(function configureMinePoolRuntime(global) {
  'use strict';

  // The UI is bundled inside the native app. Only online services are remote.
  // Override this value before this script in staging builds when required.
  var productionServer = 'https://api.taingames.com';
  var isLocalPreview = global.location && (global.location.hostname === '127.0.0.1' || global.location.hostname === 'localhost');
  var serviceServer = isLocalPreview ? global.location.origin : productionServer;

  global.MINEPOOL_SERVER_URL = global.MINEPOOL_SERVER_URL || serviceServer;
  global.MINEPOOL_API_URL = global.MINEPOOL_API_URL || serviceServer + '/api';
})(window);
