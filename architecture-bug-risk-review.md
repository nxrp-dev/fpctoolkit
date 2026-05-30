# Nexus Pascal Architecture Bug-Risk Review

Status: Parked review notes  
Date: 2026-05-30  
Scope: Architecture flaws likely to create future bugs  
Non-scope: Style preferences, speculative maybe-someday concerns, and implementation authorization

This file records architecture-risk notes for later review. It is not a Codex work request, not a Codex work plan, and not implementation authorization.

## Review Standard

The findings below are included only where the current structure is likely to produce real wrong behavior.

The review prioritizes concrete bug-creating architectural patterns such as:

- duplicated state
- unclear ownership
- lifecycle ordering problems
- hidden coupling
- error paths that can silently diverge

Items are prioritized by severity and likelihood of bug creation.

## Priority 1 — Default project/target selection is order-dependent

Severity: High  
Likelihood: High

The extension derives the active/default target from discovered projects rather than from an explicit selected project/target or the active editor context.

The core problem is in `src/services/pascalProjectModelService.ts`:

```ts
return projects[0]?.targets[0];
```

This happens after `loadProjects()` builds a project list from adapter discovery order.

That is tolerable in a one-project workspace. It is not safe in this repo shape, because the repo already contains many `.lpi`, `.lpr`, `.dpr`, and `.nxp` candidates. Discovery walks the filesystem using `fs.readdirSync` without a stable explicit sort in both FPC and Lazarus adapters.

Relevant areas:

- `src/services/pascalProjectModelService.ts`
- `src/projectTypes/fpcProjectAdapter.ts`
- `src/projectTypes/lazarusProjectAdapter.ts`
- `src/languageServer/client.ts`
- `src/services/debugBuildService.ts`

Likely bug: language server context, debug auto-build, and task generation can silently bind to the wrong project depending on directory order, filesystem behavior, or newly added project files.

This is not cosmetic. The language server initializes from `getDefaultLanguageServerContext()`, and debug auto-build uses `ensureDefaultTarget()`. If the default target is wrong, the user gets wrong symbols, wrong compile options, or the wrong project built before debugging.

Fix direction: make current target explicit. Either workspace-persist a selected target, derive it from active editor ownership, or require project affinity. Also sort discovered projects/targets deterministically, but sorting alone only makes the bug repeatable; it does not make the architecture correct.

## Priority 2 — The extension is globally rooted to the first workspace folder

Severity: High  
Likelihood: Medium-high

Activation chooses only the first workspace folder:

```ts
const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
```

That `workspaceRoot` is then passed into nearly every service: project adapters, task services, template creation, debug build service, language server context, and related systems.

Debug build repeats the same assumption.

Relevant areas:

- `src/services/nexusPascalExtension.ts`
- `src/services/debugBuildService.ts`

Likely bug: in a multi-root VS Code workspace, commands launched from folder B can use folder A's tasks, project discovery, templates, compiler context, and default target. This becomes especially dangerous because the extension also auto-discovers projects recursively.

Fix direction: model workspace folders explicitly. Either create per-folder service instances, or route every command/debug/task operation through the relevant `WorkspaceFolder`. At minimum, commands using a `resource` should resolve the owning workspace folder and not fall back to `workspaceFolders[0]`.

## Priority 3 — Language server context becomes stale after project changes

Severity: High  
Likelihood: Medium-high

The language server initialization options are computed once during client initialization.

The project context is pulled once from `getDefaultLanguageServerContext()` and applied to initialization options. Project file changes later only call `refresh()` on the project workspace service.

The current refresh path only fires an internal event. It does not restart or reconfigure the language server. The obvious restart path is task-configuration change notification, wired from the FPC task provider to `languageClient.restart()`, and that notification is only called from task refresh logic.

Relevant areas:

- `src/languageServer/client.ts`
- `src/services/pascalProjectWorkspaceService.ts`
- `src/services/nexusPascalExtension.ts`

Likely bug: adding/removing `.lpi`, changing Lazarus build modes, adding a project file, or changing project ownership can update the extension's project model while the language server continues using the old initialization context.

Fix direction: separate project-list changes from language-server compile-context changes. When the effective LS target/context changes, restart or send an explicit reconfigure notification. The decision should compare a stable context signature, not just a task option string.

## Priority 4 — Debug auto-build can treat an unknown task result as success

Severity: High  
Likelihood: Medium

In debug auto-build, `waitForTask()` listens to both `onDidEndTaskProcess` and `onDidEndTask`.

The process event handles real exit codes. The generic task-end event treats completion as success even when the exit code is unknown.

Relevant area:

- `src/services/debugBuildService.ts`

Likely bug: stale binaries can be debugged after a failed or incomplete compile, and the extension will believe the source has been rebuilt.

Fix direction: never treat “task ended” as build success. Only clear the source-changed state on known exit code `0`. Unknown result should either block, warn, or preserve the dirty state.

## Priority 5 — Build terminal can hang on spawn failure and cannot cancel the child process

Severity: High  
Likelihood: Medium

`BuildTaskTerminal.executeBuild()` starts a process and listens for `stdout`, `stderr`, and `close`, but it does not listen for the child process `error` event.

If the executable is missing, invalid, lacks permissions, or fails to spawn, the promise can remain unresolved and the terminal/task can hang.

Also, `BaseBuildTerminal.close()` is empty, so cancelling or closing the VS Code task terminal does not kill the compiler process.

Relevant areas:

- `src/terminal/buildTaskTerminal.ts`
- `src/terminal/buildTerminal.ts`

Likely bug: bad compiler path or transient execution failure leaves a hung task; user cancellation leaves orphan compiler/lazbuild processes.

Fix direction: handle `process.on('error')`, emit a terminal failure, fire close with nonzero status, and implement `close()` to kill the child process if still running.

## Priority 6 — Task cache is keyed by display name only

Severity: Medium-high  
Likelihood: Medium

Both task providers use `Map<string, vscode.Task>` keyed by task name.

FPC resolution checks `_task.name` and reuses the cached task if the display name matches.

Relevant area:

- `src/vscode/vscodeTaskProvider.ts`

Likely bug: two tasks with the same visible name can collide and reuse/update the wrong task definition. This is especially likely as the system grows multiple project types, generated tasks, user-defined tasks, and discovered tasks.

Even if generated names are currently somewhat descriptive, task labels are not a safe identity boundary.

Fix direction: key task cache by a stable task identity: type + project file + build mode + cwd, not display name.

## Priority 7 — FPC option generation is not centralized enough

Severity: Medium  
Likelihood: Medium

Build command arguments and language-server compile options both route through `createBuildOptionArguments()`, which is good. But the behavior is still split by flags.

Actual FPC build and language-server compile options do not clearly share one explicit policy for which options affect build, language server, or both. Custom options can be included or excluded depending on the path and on `isLazarusBuildMode`, which is an optional field on an FPC task definition.

Relevant areas:

- `src/build/buildOptionArguments.ts`
- `src/build/fpcCommandBuilder.ts`
- `src/languageServer/options.ts`
- `src/providers/taskDefinitions.ts`

Likely bug: user-provided custom compiler options can affect one path but not another, or silently disappear from both depending on how the task definition was produced. That is exactly the kind of build-vs-language-server divergence that later looks like “the code compiles but IntelliSense is wrong” or “LS accepts it but build fails.”

Fix direction: define a single policy for which options affect build, language server, or both. Do not hide that behind `isLazarusBuildMode` on an FPC task definition.

## Priority 8 — Project creation has conflict detection but execution still overwrites

Severity: Medium  
Likelihood: Medium

The wizard detects output conflicts client-side and asks for confirmation, but actual file creation is performed later by separate services that write directly.

Relevant areas:

- `src/wizard/wizardPanel.ts`
- `src/providers/projectTemplate.ts`
- `src/projectCreation/nexusProjectRemoteWizardDefinition.ts`

Likely bug: time-of-check/time-of-use overwrite. If files appear between preview and execute, or if the server returns a different file list than the preview, execution can overwrite without a fresh guard. The remote Nexus project path is especially exposed because the client writes whatever files the language server returns.

Fix direction: the final write operation should own overwrite policy. Preview conflict checks are useful UI, but the write layer should still enforce “fail unless overwrite explicitly approved.”

## Severity Order

1. Order-dependent default target — most likely to create confusing wrong-project bugs.
2. Single first-workspace-root architecture — serious in multi-root or monorepo usage.
3. Stale language-server context after project changes — likely LS correctness bug.
4. Debug auto-build treats unknown result as success — can debug stale binaries.
5. Build terminal spawn/cancel lifecycle holes — can hang tasks or orphan processes.
6. Task cache keyed by display name — wrong task reuse when names collide.
7. Compiler option policy split — build/LS divergence risk.
8. Project creation overwrite enforcement split — real overwrite bug, but narrower surface.

## Summary

The first three findings are the most architectural. They all point to the same deeper issue: project/target ownership is not explicit enough yet, and several systems are forced to guess from workspace-global discovery.

This file should remain a parked reference until one of these issues becomes active work.
