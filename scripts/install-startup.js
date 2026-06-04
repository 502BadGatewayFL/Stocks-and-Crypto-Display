const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const appName = 'StockDisplay';
const startupDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const shortcutPath = path.join(startupDir, `${appName}.lnk`);
const appRoot = path.resolve(__dirname, '..');
const electronExe = path.join(appRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const target = fs.existsSync(electronExe) ? electronExe : process.execPath;
const taskName = appName;

fs.mkdirSync(startupDir, { recursive: true });

if (fs.existsSync(shortcutPath)) {
  fs.unlinkSync(shortcutPath);
}

const script = `
$action = New-ScheduledTaskAction `
  + `-Execute '${target.replaceAll("'", "''")}' `
  + `-Argument '"${appRoot.replaceAll("'", "''")}"' `
  + `-WorkingDirectory '${appRoot.replaceAll("'", "''")}'
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  + `-AllowStartIfOnBatteries `
  + `-DontStopIfGoingOnBatteries `
  + `-ExecutionTimeLimit (New-TimeSpan -Hours 0)
Register-ScheduledTask `
  + `-TaskName '${taskName.replaceAll("'", "''")}' `
  + `-Action $action `
  + `-Trigger $trigger `
  + `-Settings $settings `
  + `-Description 'Starts StockDisplay immediately when the user logs in.' `
  + `-Force | Out-Null
`;

execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
  stdio: 'inherit'
});

console.log(`Installed startup scheduled task: ${taskName}`);
