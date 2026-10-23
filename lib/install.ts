/** Browser-only helpers: is this an iPhone/iPad, is the page running as the installed Home Screen app, or inside an in-app browser. */
export type InstallState = { ios: boolean; standalone: boolean; inApp: boolean };

export const SKIP_INSTALL_KEY = "le-nid-skip-install";

export function installState(): InstallState {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad in desktop mode
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
  // In-app browsers (Instagram, Facebook, Messenger, Snapchat, Gmail and similar) cannot add to the Home Screen.
  // Safari, and Chrome/Firefox/Edge on iOS 16.4+, can.
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|Twitter|GSA\//.test(ua)
    || (ios && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua));
  return { ios, standalone, inApp };
}
