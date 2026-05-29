import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CompileOption } from '../languageServer/options';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { LazarusBuildTarget, LazarusProjectModel, PascalBuildTarget, PascalProject } from '../model/pascalProject';
import { readLazarusBuildModes } from '../providers/lazarus';
import { LazarusTaskDefinition } from '../providers/taskDefinitions';
import { WorkspaceTasksService } from '../services/workspaceTasksService';
import { LazarusTaskProvider } from '../vscode/vscodeTaskProvider';
import { PascalProjectAdapter, ProjectCollection } from './pascalProjectAdapter';

export class LazarusProjectAdapter implements PascalProjectAdapter {
    public readonly kind = 'lazarus' as const;

    public constructor(
        private readonly workspaceRoot: string,
        private readonly workspaceTasks: WorkspaceTasksService,
        private readonly taskProvider: LazarusTaskProvider
    ) {
    }

    public collectProjects(collection: ProjectCollection): void {
        for (const taskDefinition of this.workspaceTasks.getTasks()) {
            if (taskDefinition.type === this.kind) {
                this.collectProject(taskDefinition, collection.projectsByFile);
            }
        }

        for (const projectFile of this.findProjectFiles(this.workspaceRoot)) {
            this.collectDiscoveredProject(projectFile, collection.projectsByFile);
        }
    }

    public createTask(target: PascalBuildTarget, taskName?: string): vscode.Task | undefined {
        if (target.kind !== this.kind) {
            return undefined;
        }

        const definition = new LazarusTaskDefinition();
        definition.project = target.projectFile;
        definition.cwd = target.cwd;
        definition.buildMode = target.buildMode;
        definition.forceRebuild = target.taskDefinition?.forceRebuild;

        return this.taskProvider.getTask(taskName || target.label, definition);
    }

    public createCompileOption(target: PascalBuildTarget | undefined): CompileOption {
        const option = new CompileOption();
        if (!target || target.kind !== this.kind) {
            return option;
        }

        option.type = this.kind;
        option.label = target.label;
        option.file = target.projectFile;
        option.cwd = target.cwd;
        option.buildOption = undefined;
        return option;
    }

    public createLanguageServerContext(target: PascalBuildTarget | undefined): LanguageServerProjectContext {
        if (!target || target.kind !== this.kind) {
            return {
                kind: this.kind,
                label: '',
                projectFile: '',
                workingDirectory: '',
                fpcOptions: [],
                allowFpcGlobalUnitPaths: false
            };
        }

        return {
            kind: this.kind,
            label: target.label,
            projectFile: target.projectFile,
            workingDirectory: target.cwd,
            buildMode: target.buildMode,
            fpcOptions: [],
            allowFpcGlobalUnitPaths: false
        };
    }

    public getProjectContextValue(_project: PascalProject): string {
        return 'lazarusproject';
    }

    public getTargetContextValue(_target: PascalBuildTarget): string {
        return 'lazarusbuildmode';
    }

    public getProjectIcon(_project: PascalProject): vscode.ThemeIcon | string | undefined {
        return path.join(__dirname, '..', 'images', 'lazarus.png');
    }

    public getTargetIcon(target: PascalBuildTarget): vscode.ThemeIcon | string | undefined {
        if (target.isDefault) {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        }

        return new vscode.ThemeIcon('gear');
    }

    private collectProject(
        taskDefinition: LazarusTaskDefinition,
        projectsByFile: Map<string, PascalProject>,
        defaultTargetIsInProjectFile = false
    ): void {
        if (!taskDefinition.project) {
            return;
        }

        const cwd = this.workspaceTasks.resolveWorkspacePath(taskDefinition.cwd);
        const projectFile = this.workspaceTasks.resolveWorkspacePath(taskDefinition.project, cwd);
        const project = this.getOrCreateProject(projectFile, projectsByFile);
        const buildMode = taskDefinition.buildMode || taskDefinition.label || 'Default';
        const label = taskDefinition.label || buildMode;

        this.addTarget(project, {
            id: this.createTargetId(projectFile, label, buildMode),
            kind: this.kind,
            label,
            projectId: project.id,
            projectFile,
            cwd: path.dirname(projectFile),
            buildMode,
            isDefault: taskDefinition.group?.isDefault === true,
            isInProjectFile: defaultTargetIsInProjectFile,
            canBuild: true,
            taskDefinition
        });

        for (const mode of readLazarusBuildModes(projectFile)) {
            this.addTarget(project, {
                id: this.createTargetId(projectFile, mode.name, mode.name),
                kind: this.kind,
                label: mode.name,
                projectId: project.id,
                projectFile,
                cwd: path.dirname(projectFile),
                buildMode: mode.name,
                isDefault: mode.isDefault,
                isInProjectFile: true,
                canBuild: true
            });
        }
    }

    private collectDiscoveredProject(projectFile: string, projectsByFile: Map<string, PascalProject>): void {
        const taskDefinition = new LazarusTaskDefinition();
        taskDefinition.project = projectFile;
        taskDefinition.cwd = path.dirname(projectFile);
        taskDefinition.buildMode = 'Default';

        this.collectProject(taskDefinition, projectsByFile, true);
    }

    private getOrCreateProject(projectFile: string, projectsByFile: Map<string, PascalProject>): LazarusProjectModel {
        const existing = projectsByFile.get(projectFile);
        if (existing?.kind === this.kind) {
            return existing;
        }

        const project: LazarusProjectModel = {
            id: projectFile,
            kind: this.kind,
            label: path.basename(projectFile),
            file: projectFile,
            fileExists: fs.existsSync(projectFile),
            isDefault: false,
            targets: []
        };
        projectsByFile.set(projectFile, project);
        return project;
    }

    private addTarget(project: LazarusProjectModel, target: LazarusBuildTarget): void {
        const key = this.getTargetKey(target);
        if (project.targets.some(candidate => this.getTargetKey(candidate) === key)) {
            return;
        }

        project.targets.push(target);
    }

    private getTargetKey(target: LazarusBuildTarget): string {
        return (target.buildMode || target.label).toLowerCase();
    }

    private createTargetId(projectFile: string, label: string, buildMode?: string): string {
        return `${projectFile}::${buildMode || label}`;
    }

    private findProjectFiles(root: string): string[] {
        const results: string[] = [];
        this.walkProjectFiles(root, file => {
            if (this.isLazarusProjectFile(file)) {
                results.push(file);
            }
        });
        return results;
    }

    private walkProjectFiles(directory: string, callback: (file: string) => void): void {
        if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
            return;
        }

        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (!this.shouldSkipDirectory(entry.name)) {
                    this.walkProjectFiles(entryPath, callback);
                }
                continue;
            }

            if (entry.isFile()) {
                callback(entryPath);
            }
        }
    }

    private isLazarusProjectFile(file: string): boolean {
        const extension = path.extname(file).toLowerCase();
        return extension === '.lpi' || extension === '.lpk';
    }

    private shouldSkipDirectory(name: string): boolean {
        return ['.git', '.svn', '.hg', '.vscode', 'node_modules', 'out', 'output', 'dist'].includes(name.toLowerCase());
    }
}
