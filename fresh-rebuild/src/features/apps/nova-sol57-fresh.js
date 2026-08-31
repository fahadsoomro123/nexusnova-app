import { novaSol57Renderers as aiRenderers } from './nova-sol57-ai-core.js';
import { everydayPremiumRenderers } from './everyday-premium-labs.js';

export const novaSol57Renderers = Object.freeze({
  ...aiRenderers,
  ...everydayPremiumRenderers
});
