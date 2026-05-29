import * as vscode from 'vscode';
import { PascalBuildTarget } from '../model/pascalProject';
import { PascalProjectAdapterRegistry } from '../projectTypes/pascalProjectAdapter';
import { BuildMode, FpcTask, LazarusTask } from '../vscode/vscodeTask';

export class PascalTaskFactory {
    public constructor(private readonly adapters: PascalProjectAdapterRegistry) {
    }

    public createTask(target: PascalBuildTarget, taskName?: string, buildMode: BuildMode = BuildMode.normal): vscode.Task | undefined {
        if (!target.canBuild) {
            return undefined;
        }

        const task = this.adapters.get(target.kind).createTask(target, taskName);
        if (task instanceof FpcTask || task instanceof LazarusTask) {
            task.BuildMode = buildMode;
        }

        return task;
    }
}
