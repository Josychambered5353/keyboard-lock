import { Menu, app } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

/**
 * macOS needs an application menu for the standard Cmd+Q / Cmd+H / editing
 * shortcuts to exist at all. Every other platform ships without a menu bar —
 * the window has its own slim controls.
 */
export function buildAppMenu(): Menu | null {
  if (process.platform !== 'darwin') return null;

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];

  return Menu.buildFromTemplate(template);
}
