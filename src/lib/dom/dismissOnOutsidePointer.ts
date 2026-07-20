export function dismissOnOutsidePointer(node: HTMLElement, onDismiss: () => void) {
  function handlePointerDown(event: PointerEvent) {
    if (event.target instanceof Node && !node.contains(event.target)) onDismiss()
  }

  document.addEventListener('pointerdown', handlePointerDown)

  return {
    destroy() {
      document.removeEventListener('pointerdown', handlePointerDown)
    },
  }
}
