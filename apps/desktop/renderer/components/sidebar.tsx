/**
 * T08 (UI-05): el monolito `sidebar.tsx` (961L) se partió en
 * `sidebar/Sidebar.tsx` + `sidebar/ProjectsModal.tsx` + `sidebar/SettingsModal.tsx`.
 * Este módulo conserva el path de importación (`components/sidebar`) como re-export fino.
 */
export { Sidebar, type SidebarProps } from "./sidebar/Sidebar.js";
export { SettingsModal, type SettingsModalProps } from "./sidebar/SettingsModal.js";
export { ProjectsModal, type ProjectsModalProps } from "./sidebar/ProjectsModal.js";
