const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const appName = 'StockDisplay';

const shortcutPath = path.join(
  process.env.APPDATA,
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup',
  `${appName}.lnk`
);

if (fs.existsSync(shortcutPath)) {
  fs.unlinkSync(shortcutPath);
  console.log(`Removed startup shortcut: ${shortcutPath}`);
} else {
  console.log('Startup shortcut was not installed.');
}

try {
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Unregister-ScheduledTask -TaskName '${appName}' -Confirm:$false -ErrorAction Stop`
  ], {
    stdio: 'inherit'
  });
  console.log(`Removed startup scheduled task: ${appName}`);
} catch {
  console.log('Startup scheduled task was not installed.');
}
