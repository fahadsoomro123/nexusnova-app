// Compatibility entry retained because existing APK/OTA manifests still load v31.
// V31 no longer owns viewport geometry. V32 is the only real layout owner.
import './travel-phone-layout-v32.js?ota=travel-v32-proof37';

// Compatibility bridge for older interaction code that still delegates through V31.
// This prevents the v28 fallback geometry from becoming a second layout owner.
const COMPAT_STYLE_ID='nn-travel-phone-layout-v31';
window.NexusNovaTravelLayoutV31={
  sync(root){ return window.NexusNovaTravelLayoutV32?.sync?.(root); }
};
// Keep the public owner truthful: this file is only an OTA compatibility entry.
// Some late Travel integrations use this marker to decide whether to inject
// fallback geometry; reporting v31 here could reactivate a second owner.
window.NexusNovaTravelLayoutOwner='v32';
window.NexusNovaTravelLayoutCompatStyleId=COMPAT_STYLE_ID;
