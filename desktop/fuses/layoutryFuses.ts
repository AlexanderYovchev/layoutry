import { FuseV1Options, FuseVersion, type FuseV1Config } from "@electron/fuses";

/**
 * Electron fuses for Layoutry's packaged Windows build (DESKTOP-0.3,
 * ADR-0002). Fuses are bits inside electron.exe itself, flipped once at
 * packaging time — they are not runtime configuration, and the stock
 * development binary in node_modules is never modified.
 *
 * `strictlyRequireAllFuses` makes an Electron upgrade that adds a new fuse
 * fail loudly until someone decides its value here.
 */
export const PACKAGED_FUSES = {
  version: FuseVersion.V1,
  strictlyRequireAllFuses: true,
  // ELECTRON_RUN_AS_NODE must not turn Layoutry.exe into a general Node.js runtime.
  [FuseV1Options.RunAsNode]: false,
  // Layoutry stores no cookies; encrypting the store (DPAPI) costs nothing and is one-way safe now.
  [FuseV1Options.EnableCookieEncryption]: true,
  // NODE_OPTIONS must not inject code (e.g. --require) into the main process.
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  // --inspect / --inspect-brk must not open a debugger on the main process.
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  // ASAR-dependent: verify app.asar against the hash embedded at packaging time.
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  // ASAR-dependent: refuse to load the app from a loose folder next to the exe.
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  // No custom browser-process V8 snapshot is shipped.
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
  // The app is served over app://, never file://; file: pages get no extra powers.
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  // Electron's default; keeps WebAssembly bounds checks fast and safe.
  [FuseV1Options.WasmTrapHandlers]: true,
} satisfies FuseV1Config;

/**
 * These two only make sense once the app is packed into app.asar
 * (DESKTOP-0.4). Flipping them on an unpacked app — the repository
 * checkout — stops Electron from loading it at all.
 */
export const ASAR_DEPENDENT_FUSES = [
  FuseV1Options.EnableEmbeddedAsarIntegrityValidation,
  FuseV1Options.OnlyLoadAppFromAsar,
] as const;

/**
 * PACKAGED_FUSES minus the ASAR-dependent ones: what the desktop test
 * suite flips on a temporary copy of electron.exe to prove the hardened
 * binary still runs Layoutry from the unpacked checkout.
 */
export const UNPACKED_VERIFICATION_FUSES = {
  ...PACKAGED_FUSES,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
  [FuseV1Options.OnlyLoadAppFromAsar]: false,
} satisfies FuseV1Config;
