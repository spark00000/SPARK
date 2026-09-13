import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function createFilePal({ stateDir }) {
  const recoveryRoot = path.join(stateDir, 'recovery');

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
      visibility: 'private-state'
    };
    await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(meta) + '\n', { encoding: 'utf8', flag: 'wx' });
    return { type: 'pal-private-snapshot', recoveryId, bytes: meta.bytes, sha256: meta.sha256, visibility: 'private-state' };
  }

  async function replaceText(absolutePath, displayPath, text, expectedSha256) {
    const before = await fs.readFile(absolutePath);
    const beforeHash = sha256(before);
    if (expectedSha256 && expectedSha256 !== beforeHash) {
      const error = new Error('file changed before replacement');
      error.code = 'STALE_FILE';
      throw error;
    }
    const recovery = await snapshot(displayPath, before);
    const after = Buffer.from(text, 'utf8');
    await fs.writeFile(absolutePath, after);
    return {
      before: { bytes: before.length, sha256: beforeHash },
      after: { bytes: after.length, sha256: sha256(after) },
      recovery
    };
  }

  async function move(sourceAbsolutePath, destinationAbsolutePath) {
    try {
      await fs.lstat(destinationAbsolutePath);
      const error = new Error('destination already exists');
      error.code = 'ALREADY_EXISTS';
      throw error;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await fs.rename(sourceAbsolutePath, destinationAbsolutePath);
  }

  return { snapshot, replaceText, move };
}
