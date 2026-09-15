/* Legacy Travel smart-context layer intentionally disabled.
 * Fare Lens now owns the complete Travel screen and must never inject the
 * obsolete blue Smart Travel Context panel into the Android runtime.
 */
export async function enhanceSmartTravelContext(id, root) {
  return () => {};
}
