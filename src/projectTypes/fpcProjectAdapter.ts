import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CompileOption } from '../languageServer/options';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { FpcBuildTarget, FpcProjectModel, PascalBuildTarget, PascalProject } from '../model/pascalProject';
import { FpcTaskDefinition } from '../providers/taskDefinitions';
import { FpcTaskProvider } from '../vscode/vscodeTaskProvider';
import { BuildConfigurationResult, PascalProjectAdapter, ProjectCollection } from './pascalProjectAdapter';
import { WorkspaceTasksService } from '../services/workspaceTasksService';

export class FpcProjectAdapter implements PascalProjectAdapter {
    public readonly kind = 'fpc' as const;

    public constructor(
        private readonly workspaceRoot: string,
        private readonly workspaceTasks: WorkspaceTasksService,
        private readonly taskProvider: FpcTaskProvider
    ) {
    }

    public collectProjects(collection: ProjectCollection): void {
        for (const taskDefinition of this.workspaceTasks.getTasks()) {
            if (taskDefinition.type === this.kind) {
                this.collectProject(taskDefinition, collection.projectsByFile);
            }
        }
    }

    public async setDefaultTarget(target: PascalBuildTarget): Promise<void> {
        if (target.kind === this.kind) {
            await this.workspaceTasks.setDefaultFpcTarget(target);
        }
    }

    public createTask(target: PascalBuildTarget): vscode.Task | undefined {
        if (target.kind !== this.kind) {
            return undefined;
        }

        return this.taskProvider.getTask(target.label, target.projectFile, target.taskDefinition);
    }

    public createCompileOption(target: PascalBuildTarget | undefined): CompileOption {
        if (!target || target.kind !== this.kind) {
            return new CompileOption();
        }

        return new CompileOption(target.taskDefinition, this.workspaceRoot);
    }

    public createLanguageServerContext(target: PascalBuildTarget | undefined): LanguageServerProjectContext {
        const option = this.createCompileOption(target);
        const fpcOptions = option.toOptionArray()
            .filter(value => value.length > 0 && !value.startsWith('-v'));

        return {
            kind: this.kind,
            label: option.label,
            projectFile: option.file,
            workingDirectory: option.cwd,
            fpcOptions,
            allowFpcGlobalUnitPaths: true
        };
    }

    public getProjectContextValue(_project: PascalProject): string {
        return 'fpcproject';
    }

    public getTargetContextValue(_target: PascalBuildTarget): string {
        return 'fpcbuild';
    }

    public getProjectIcon(_project: PascalProject): vscode.ThemeIcon | string | undefined {
        return path.join(__dirname, '..', 'images', 'pascal-project.png');
    }

    public getTargetIcon(target: PascalBuildTarget): vscode.ThemeIcon | string | undefined {
        if (target.isDefault) {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        }

        return new vscode.ThemeIcon('tools');
    }

    public canAddBuildConfiguration(_project: PascalProject): boolean {
        return true;
    }

    public buildConfigurationUnavailableMessage(_project: PascalProject): string {
        return '';
    }

    public async createBuildConfiguration(project: PascalProject, label: string): Promise<BuildConfigurationResult> {
        const tasks = this.workspaceTasks.getAllTasks();
        const finalLabel = this.workspaceTasks.getUniqueFpcTaskLabel(label, project.label, tasks);
        if (!finalLabel) {
            return {
                created: false,
                message: `Task "${label}" already exists for this project. Skipping task creation.`
            };
        }

        tasks.push(this.workspaceTasks.createFpcTask(finalLabel, project.label));
        await this.workspaceTasks.updateTasks(tasks);
        return { created: true };
    }

    private collectProject(taskDefinition: FpcTaskDefinition, projectsByFile: Map<string, PascalProject>): void {
        if (!taskDefinition.file) {
            return;
        }

        const cwd = this.workspaceTasks.resolveWorkspacePath(taskDefinition.cwd);
        const projectFile = this.workspaceTasks.resolveWorkspacePath(taskDefinition.file, cwd);
        const project = this.getOrCreateProject(projectFile, taskDefinition, projectsByFile);
        const label = taskDefinition.label || project.label;

        project.targets.push({
            id: this.createTargetId(projectFile, label),
            kind: this.kind,
            label,
            projectId: project.id,
            projectFile,
            isDefault: taskDefinition.group?.isDefault === true,
            isInProjectFile: false,
            canBuild: true,
            taskDefinition
        });
    }

    private getOrCreateProject(
        projectFile: string,
        taskDefinition: FpcTaskDefinition,
        projectsByFile: Map<string, PascalProject>
    ): FpcProjectModel {
        const existing = projectsByFile.get(projectFile);
        if (existing?.kind === this.kind) {
            return existing;
        }

        const project: FpcProjectModel = {
            id: projectFile,
            kind: this.kind,
            label: path.basename(taskDefinition.file || projectFile),
            file: projectFile,
            fileExists: fs.existsSync(projectFile),
            isDefault: false,
            targets: []
        };
        projectsByFile.set(projectFile, project);
        return project;
    }

    private createTargetId(projectFile: string, label: string): string {
        return `${projectFile}::${label}`;
    }
}
