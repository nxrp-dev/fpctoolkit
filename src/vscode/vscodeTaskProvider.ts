import * as vscode from 'vscode';
import * as path from 'path';
import { FpcTaskDefinition, LazarusTaskDefinition, isFpcTaskDefinition, isLazarusTaskDefinition } from '../providers/taskDefinitions';
import { FpcTask, LazarusTask } from './vscodeTask';
import { FPC_TASK_TYPE, LAZARUS_TASK_TYPE } from './vscodeTaskTypes';

type TaskSource = () => vscode.Task[];

export class FpcTaskProvider implements vscode.TaskProvider {
    static FpcTaskType = FPC_TASK_TYPE;
    public taskMap: Map<string, vscode.Task> = new Map<string, vscode.Task>();
    private taskSource?: TaskSource;

    constructor(
        private workspaceRoot: string,
        private readonly onTaskConfigurationChanged: () => void,
        private cwd: string | undefined = undefined
    ) {
    }

    public clean(): void {
        this.taskMap.clear();
    }

    public setTaskSource(taskSource: TaskSource): void {
        this.taskSource = taskSource;
    }

    public async provideTasks(): Promise<vscode.Task[]> {
        return this.getTasks();
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        if (!isFpcTaskDefinition(_task.definition)) {
            return undefined;
        }

        const definition = _task.definition;
        const file = definition.file;
        if (!file) {
            return undefined;
        }

        if (this.taskMap.has(_task.name)) {
            const task = this.taskMap.get(_task.name);
            task!.definition = definition;
            return task;
        }

        const task = this.getTask(_task.name, file, definition);
        this.applyResolvedTaskMetadata(_task, task);
        this.taskMap.set(_task.name, task);
        return task;
    }

    private async getTasks(): Promise<vscode.Task[]> {
        this.taskMap.clear();
        return this.taskSource ? this.taskSource() : [];
    }

    public getTask(name: string, file: string, definition: FpcTaskDefinition): vscode.Task {
        const task = new FpcTask(this.resolveCwd(definition.cwd), name, file, definition);
        this.taskMap.set(name, task);
        return task;
    }

    public notifyTaskConfigurationChanged(): void {
        this.onTaskConfigurationChanged();
    }

    private resolveCwd(rawCwd?: string): string {
        if (!rawCwd) {
            return this.cwd ? this.cwd : this.workspaceRoot;
        }
        if (rawCwd.includes('${workspaceFolder}')) {
            return rawCwd.replace(/\$\{workspaceFolder\}/g, this.workspaceRoot);
        }
        if (path.isAbsolute(rawCwd)) {
            return rawCwd;
        }
        return path.join(this.workspaceRoot, rawCwd);
    }

    private applyResolvedTaskMetadata(source: vscode.Task, target: vscode.Task): void {
        if (source.group) {
            target.group = source.group;
        }
        if (source.problemMatchers.length > 0) {
            target.problemMatchers = source.problemMatchers;
        }
    }
}

export class LazarusTaskProvider implements vscode.TaskProvider {
    static LazarusTaskType = LAZARUS_TASK_TYPE;
    public taskMap: Map<string, vscode.Task> = new Map<string, vscode.Task>();
    private taskSource?: TaskSource;

    constructor(private workspaceRoot: string) {
    }

    public setTaskSource(taskSource: TaskSource): void {
        this.taskSource = taskSource;
    }

    public async provideTasks(): Promise<vscode.Task[]> {
        this.taskMap.clear();
        return this.taskSource ? this.taskSource() : [];
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        if (!isLazarusTaskDefinition(_task.definition)) {
            return undefined;
        }

        const task = this.getTask(_task.name, _task.definition);
        this.applyResolvedTaskMetadata(_task, task);
        this.taskMap.set(_task.name, task);
        return task;
    }

    public getTask(name: string, definition: LazarusTaskDefinition): vscode.Task {
        const task = new LazarusTask(this.resolveCwd(definition.cwd), name, definition);
        this.taskMap.set(name, task);
        return task;
    }

    private resolveCwd(rawCwd?: string): string {
        if (!rawCwd) {
            return this.workspaceRoot;
        }
        if (rawCwd.includes('${workspaceFolder}')) {
            return rawCwd.replace(/\$\{workspaceFolder\}/g, this.workspaceRoot);
        }
        if (path.isAbsolute(rawCwd)) {
            return rawCwd;
        }
        return path.join(this.workspaceRoot, rawCwd);
    }

    private applyResolvedTaskMetadata(source: vscode.Task, target: vscode.Task): void {
        if (source.group) {
            target.group = source.group;
        }
        if (source.problemMatchers.length > 0) {
            target.problemMatchers = source.problemMatchers;
        }
    }
}
