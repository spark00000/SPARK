# PAL Transparency Invariant

SPARK file operations must preserve logical-to-physical transparency.

1. A logical `move_path` is one rename/move operation. It must not create an additional backup or sibling artifact.
2. If the destination already exists, `move_path` fails with `ALREADY_EXISTS` and leaves source and destination unchanged.
3. Recovery for `write_file` and `modify_file` belongs to the physical file PAL and private runtime state, not the user's workspace.
4. User-workspace backup, scratch, or temporary files are forbidden unless the user explicitly requests them as artifacts.
5. File CRUD/rename intents must use FileService tools rather than `run_command`.
6. Tests must assert that write/modify/move create no unexpected workspace entries.

## Audit finding

The current `move_path` already performs direct rename semantics and collision checks. However, current write/modify implementation still contains workspace sibling scratch names (`.spark-tmp-*`, `.spark-old-*`) inside `src/tools.mjs`; this violates the strict transparency rule even if they are normally cleaned up. Recovery logic is also implemented in the logical tool module rather than behind a concrete file PAL boundary.

Therefore PAL transparency remains an open architecture/implementation gate until those two issues are refactored and regression-tested.
