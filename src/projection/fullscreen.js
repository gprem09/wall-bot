export async function enterProjectorFullscreen() {
  const el = document.documentElement;
  if ('getScreenDetails' in window) {
    try {
      const details = await window.getScreenDetails();
      const external = details.screens.find((s) => !s.isPrimary) ?? details.currentScreen;
      await el.requestFullscreen({ screen: external });
      return;
    } catch (err) {
      console.warn('[fullscreen] screen selection unavailable, using current display', err);
    }
  }
  await el.requestFullscreen();
}

export function toggleFullscreen() {
  if (document.fullscreenElement) return document.exitFullscreen();
  return enterProjectorFullscreen();
}
