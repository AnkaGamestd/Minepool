(function configureMinePoolRuntime(global) {
  'use strict';

  // The UI is bundled inside the native app. Only online services are remote.
  // Override this value before this script in staging builds when required.
  var productionServer = 'https://api.taingames.com';

  global.MINEPOOL_SERVER_URL = global.MINEPOOL_SERVER_URL || productionServer;
  global.MINEPOOL_API_URL = global.MINEPOOL_API_URL || productionServer + '/api';
})(window);
