// V40 geometry diagnostics completed on the physical phone.
// Result: root/frame/stage/panel/card all reach to within 13px of the real dock,
// so the apparent black gap is a paint/compositor problem, not missing geometry.
// Keep this compatibility entry because v31 already imports it in signed/OTA builds.
import './travel-compositor-stability-v41.js?ota=travel-c41-compositor-reset';
