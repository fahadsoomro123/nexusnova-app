// Nova Drive visible runtime.
// Keep the proven native auto-drive renderer as the data/action engine and mount
// only one visual layer on top. Legacy approved/v13 visual stacks are intentionally
// not imported here because parallel observers/timers can stall Android WebView.
import './nova-drive-gold-maptiler-v14-ui.js?ota=drive-gold-vector-v16';
import './nova-drive-vector-map-v16.js?ota=drive-gold-vector-v16';
import './nova-drive-history-archive-v16.js?ota=drive-history-archive-v16';
import './nova-drive-gold-maptiler-v14-production.js?ota=drive-gold-vector-v16';
import './nova-drive-private-tracker-v15.js?ota=drive-private-tracker-v15';
import './nova-drive-auto-arm-v15.js?ota=drive-auto-arm-v15';
import './nova-drive-recover-premium-v17.js?ota=drive-recover-premium-v18';
