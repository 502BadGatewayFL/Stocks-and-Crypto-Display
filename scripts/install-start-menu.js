const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const electronExe = path.join(appRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const electronTarget = fs.existsSync(electronExe) ? electronExe : process.execPath;
const startMenuDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Stock Market Display');

fs.mkdirSync(startMenuDir, { recursive: true });

function ps(value) {
  return String(value).replaceAll("'", "''");
}

const shortcuts = [
  {
    name: 'Stock Market Display',
    target: electronTarget,
    args: `"${appRoot}"`,
    description: 'Open the fullscreen market display.'
  },
  {
    name: 'Stock Market Display Settings',
    target: electronTarget,
    args: `"${appRoot}" --settings`,
    description: 'Change assets, timing, display target, API settings, and colors.'
  },
  {
    name: 'Stock Market Display Terminal',
    target: 'powershell.exe',
    args: '-NoExit',
    description: 'Open a terminal in the Stock Market Display project folder.'
  }
];

const script = shortcuts.map((shortcut) => `
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut('${ps(path.join(startMenuDir, `${shortcut.name}.lnk`))}')
$shortcut.TargetPath = '${ps(shortcut.target)}'
$shortcut.Arguments = '${ps(shortcut.args)}'
$shortcut.WorkingDirectory = '${ps(appRoot)}'
$shortcut.Description = '${ps(shortcut.description)}'
$shortcut.Save()
`).join('\n');

execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
  stdio: 'inherit'
});

console.log(`Installed Start Menu shortcuts in: ${startMenuDir}`);
