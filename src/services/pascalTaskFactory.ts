import * as vscode from 'vscode';
import { PascalBuildTarget } from '../model/pascalProject';
import { PascalProjectAdapterRegistry } from '../projectTypes/pascalProjectAdapter';

export class PascalTaskFactory {
    public constructor(private readonly adapters: PascalProjectAdapterRegistry) {
    }

    public createTask(target: PascalBuildTarget): vscode.Task | undefined {
        if (!target.canBuild) {
            return undefined;
        }

        return this.adapters.get(target.kind).createTask(target);
    }
}
