// Legacy entrypoint retained only as a compatibility shim.
// The canonical Mining rewards Worker is index-v2.js.
// Keeping this shim prevents any accidental legacy deploy from restoring
// retired ad-to-NVX or ad-to-mining-value reward logic.
import workerV2 from './index-v2.js';

export default workerV2;
