import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function createFilePal({ stateDir }) {
  const recoveryRoot = path.join(stateDir, 'recovery');

  async function ensureAbsent(target) {
    try {
      await fs.lstat(target);
      const error = new Error('destination already exists');
      error.code = 'ALREADY_EXISTS';
      throw error;
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
  }

  async function snapshot(displayPath, bytes) {
    const recoveryId = crypto.randomUUID();
    const dir = path.join(recoveryRoot, recoveryId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'content.bin'), bytes, { flag: 'wx' });
    const meta = {
      recoveryId,
      originalPath: displayPath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      createdAt: new Date().toISOString(),
      visibility: 'private-state',
    };
    await fs.writeFile(path.join(dir, 'metadata.json'), `${JSON.stringify(meta)}\n`, { encoding: 'utf8', flag: 'wx' });
    return { type: 'pal-private-snapshot', recoveryId, bytes: meta.bytes, sha256: meta.sha256, visibility: meta.visibility };
  }

  async function readBytes(absolutePath) {
    return fs.readFile(absolutePath);
  }

  async function listDirectory(absolutePath) {
    const dirents = await fs.readdir(absolutePath, { withFileTypes: true });
    const entries = [];
    for (const d of dirents) {
      const absolute = path.join(absolutePath, d.name);
      let type = 'other';
      let size;
      try {
        const st = await fs.lstat(absolute);
        if (st.isSymbolicLink()) type = 'symlink';
        else if (st.isDirectory()) type = 'directory';
        else if (st.isFile()) { type = 'file'; size = st.size; }
      } catch {
        type = 'unavailable';
      }
      entries.push({ name: d.name, type, ...(size === undefined ? {} : { size }) });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    return entries;
  }

  async function createTextFile(absolutePath, text) {
    const bytes = Buffer.from(text, 'utf8');
    await fs.writeFile(absolutePath, bytes, { flag: 'wx' });
    return { bytes: bytes.length, sha256: sha256(bytes) };
  }

  async function replaceTextFile({ absolutePath, displayPath, text, expectedBeforeSha256 }) {
    const before = await fs.readFile(absolutePath);
    const beforeSha256 = sha256(before);
    if (expectedBeforeSha256 && expectedBeforeSha256 !== beforeSha256) {
      const error = new Error('file changed after logical read; replacement was not attempted');
      error.code = 'STALE_FILE';
      throw error;
    }
    const recovery = await snapshot(displayPath, before);
    const after = Buffer.from(text, 'utf8');
    try {
      await fs.writeFile(absolutePath, after);
    } catch (writeError) {
      try {
        await fs.writeFile(absolutePath, before);
      } catch (restoreError) {
        const error = new Error(`file replacement failed and PAL rollback failed: ${restoreError.message}`);
        error.code = 'PAL_ROLLBACK_FAILED';
        error.cause = writeError;
        throw error;
      }
      throw writeError;
    }
    return {
      before: { bytes: before.length, sha256: beforeSha256 },
      after: { bytes: after.length, sha256: sha256(after) },
      recovery,
    };
  }

  async function createDirectory(absolutePath, recursive = false) {
    await fs.mkdir(absolutePath, { recursive });
  }

  async function copyPath(sourceAbsolutePath, destinationAbsolutePath, isDirectory) {
    await ensureAbsent(destinationAbsolutePath);
    await fs.cp(sourceAbsolutePath, destinationAbsolutePath, { recursive: isDirectory, errorOnExist: true, force: false });
  }

  async function movePath(sourceAbsolutePath, destinationAbsolutePath) {
    await ensureAbsent(destinationAbsolutePath);
    await fs.rename(sourceAbsolutePath, destinationAbsolutePath);
  }

  return {
    readBytes,
    listDirectory,
    createTextFile,
    replaceTextFile,
    createDirectory,
    copyPath,
    movePath,
  };
}
