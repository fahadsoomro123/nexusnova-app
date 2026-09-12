// Travel reset: keep the shared app-screen import contract, but disable all
// post-render Travel enhancement layers. The clean Travel suite owns its UI.
export function enhanceTravelApp(_id, root) {
  return root;
}
