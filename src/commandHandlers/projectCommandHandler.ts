import * as fs from 'fs';
import * as vscode from 'vscode';
import { PascalProjectTreeItem } from '../providers/pascalProjectTreeItem';
import { PascalProjectAdapterRegistry } from '../projectTypes/pascalProjectAdapter';
import { PascalProjectModelService } from '../services/pascalProjectModelService';
import { PascalTaskFactory } from '../services/pascalTaskFactory';
import { LanguageClientHandle } from '../services/languageClientHandle';
import { WorkspaceTasksService } from '../services/workspaceTasksService';
import { BuildMode, FpcTask, LazarusTask } from '../vscode/vscodeTask';
import { FpcTaskProvider, LazarusTaskProvider } from '../vscode/vscodeTaskProvider';

const BUILD_LABELS = ['debug', 'release', 'Other ...'];

export class ProjectCommandHandler {
    public constructor(
        private readonly workspaceRoot: string,
        private readonly taskProvider: FpcTaskProvider,
        private readonly lazarusTaskProvider: LazarusTaskProvider,
        private readonly projectModelService: PascalProjectModelService,
        private readonly taskFactory: PascalTaskFactory,
        private readonly workspaceTasks: WorkspaceTasksService,
        private readonly projectAdapters: PascalProjectAdapterRegistry,
        private readonly refreshProjects: () => void,
        private readonly languageClient: LanguageClientHandle
    ) {
    }

    public register(context: vscode.ExtensionContext): void {
        this.registerCommand(context, 'nexusPascal.project.build', this.projectBuild);
        this.registerCommand(context, 'nexusPascal.project.rebuild', this.projectRebuild);
        this.registerCommand(context, 'nexusPascal.project.opensetting', this.projectOpen);
        this.registerCommand(context, 'nexusPascal.project.add', this.projectAdd);
        this.registerCommand(context, 'nexusPascal.project.setdefault', this.projectSetDefault);
        this.registerCommand(context, 'nexusPascal.project.openWithLazarus', this.openWithLazarus);
    }

    private registerCommand(
        context: vscode.ExtensionContext,
        command: string,
        handler: (...args: any[]) => unknown
    ): void {
        context.subscriptions.push(vscode.commands.registerCommand(command, handler));
    }

    private projectAdd = async (node?: PascalProjectTreeItem): Promise<void> => {
        if (!node || node.level !== 0) {
            return;
        }

        if (!node.project) {
            return;
        }

        const adapter = this.projectAdapters.get(node.project.kind);
        if (!adapter.canAddBuildConfiguration(node.project)) {
            vscode.window.showInformationMessage(adapter.buildConfigurationUnavailableMessage(node.project));
            return;
        }

        const label = await this.askForBuildLabel();
        if (!label) {
            return;
        }

        const result = await adapter.createBuildConfiguration(node.project, label);
        if (!result.created && result.message) {
            vscode.window.showWarningMessage(result.message);
        }
    };

    private projectBuild = async (node?: PascalProjectTreeItem): Promise<void> => {
        await this.executeProjectTask(node, false);
    };

    private projectRebuild = async (node?: PascalProjectTreeItem): Promise<void> => {
        await this.executeProjectTask(node, true);
    };

    private projectOpen = async (node?: PascalProjectTreeItem): Promise<void> => {
        const tasksFile = this.workspaceTasks.getTaskFilePath();
        if (!fs.existsSync(tasksFile)) {
            vscode.window.showErrorMessage('Task configuration file not found.');
            return;
        }

        const document = await vscode.workspace.openTextDocument(tasksFile);
        const selection = this.findTaskSelection(document, node?.label);
        await vscode.window.showTextDocument(document, { selection });
    };

    private projectSetDefault = async (node?: PascalProjectTreeItem): Promise<void> => {
        if (!node || node.level !== 1 || !node.target) {
            return;
        }

        await this.projectModelService.setDefaultTarget(node.target);
        await this.refreshProjectExplorer();
        await this.restartLanguageServer();
    };

    private openWithLazarus = async (node?: PascalProjectTreeItem): Promise<void> => {
        if (!node || node.level !== 0 || node.project?.kind !== 'lazarus') {
            vscode.window.showErrorMessage('This command is only available for Lazarus projects.');
            return;
        }

        const projectFile = this.workspaceTasks.resolveWorkspacePath(node.file);
        if (!fs.existsSync(projectFile)) {
            vscode.window.showErrorMessage(`Project file not found: ${projectFile}`);
            return;
        }

        try {
            await vscode.env.openExternal(vscode.Uri.file(projectFile));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open with default application: ${error}`);
        }
    };

    private async executeProjectTask(node: PascalProjectTreeItem | undefined, rebuild: boolean): Promise<void> {
        if (!node || node.level === 0) {
            return;
        }

        if (!node.target) {
            vscode.window.showErrorMessage('Invalid project task.');
            return;
        }

        const task = this.taskFactory.createTask(node.target);
        if (!task) {
            vscode.window.showInformationMessage(`Build is not wired for ${node.target.label}.`);
            return;
        }

        if (rebuild) {
            this.setTaskBuildMode(task, BuildMode.rebuild);
        }

        await vscode.tasks.executeTask(task);
    }

    private setTaskBuildMode(task: vscode.Task, buildMode: BuildMode): void {
        const liveTask =
            this.taskProvider.taskMap.get(task.name) ||
            this.lazarusTaskProvider.taskMap.get(task.name) ||
            task;

        if (liveTask instanceof FpcTask || liveTask instanceof LazarusTask) {
            liveTask.BuildMode = buildMode;
        }
    }

    private async askForBuildLabel(): Promise<string | undefined> {
        const selected = await vscode.window.showQuickPick(BUILD_LABELS, { canPickMany: false });
        if (!selected) {
            return undefined;
        }

        if (selected !== 'Other ...') {
            return selected;
        }

        const customLabel = await vscode.window.showInputBox({ prompt: 'Input build label:' });
        return customLabel?.trim() || undefined;
    }

    private findTaskSelection(document: vscode.TextDocument, label?: string): vscode.Selection | undefined {
        if (!label) {
            return undefined;
        }

        const offset = document.getText().indexOf(`"label": "${label}"`);
        if (offset < 0) {
            return undefined;
        }

        const position = document.positionAt(offset);
        return new vscode.Selection(position, position);
    }

    private async refreshProjectExplorer(): Promise<void> {
        this.refreshProjects();
    }

    private async restartLanguageServer(): Promise<void> {
        await this.languageClient.restart();
    }
}
