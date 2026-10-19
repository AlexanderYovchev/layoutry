/**
 * The desktop shell's single trusted origin (ADR-0002). The bundled static
 * export is served from here by the app:// protocol handler, and it is the
 * only origin the main window may ever navigate to.
 */
export const APP_SCHEME = "app";
export const APP_HOST = "layoutry";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const APP_ENTRY_URL = `${APP_ORIGIN}/`;
