import { spawn } from 'node:child_process';

function psQuote(value) { return `'${String(value).replaceAll("'", "''")}'`; }

export async function moveToRecycleBin(absolutePath, isDirectory) {
  if (process.platform !== 'win32') {
    const error = new Error('Recycle Bin delete is supported only on Windows in Sprint-2');
    error.code = 'RECYCLE_BIN_UNAVAILABLE';
    throw error;
  }
  const method = isDirectory ? 'DeleteDirectory' : 'DeleteFile';
  const script = [
    'Add-Type -AssemblyName Microsoft.VisualBasic',
    `$p=${psQuote(absolutePath)}`,
    `[Microsoft.VisualBasic.FileIO.FileSystem]::${method}($p, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)`,
  ].join('; ');
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else {
        const error = new Error(stderr.trim() || `Recycle Bin operation failed with exit code ${code}`);
        error.code = 'RECYCLE_BIN_FAILED';
        reject(error);
      }
    });
  });
}
