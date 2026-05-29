import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CompileOption } from '../languageServer/options';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { FpcBuildTarget, FpcProjectModel, PascalBuildTarget, PascalProject } from '../model/pascalProject';
import { FpcTaskDefinition } from '../providers/taskDefinitions';
import { FpcTaskProvider } from '../vscode/vscodeTaskProvider';
import { PascalProjectAdapter, ProjectCollection } from './pascalProjectAdapter';
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

        for (const projectFile of this.findProjectFiles(this.workspaceRoot)) {
            this.collectDiscoveredProject(projectFile, collection.projectsByFile);
        }
    }

    public createTask(target: PascalBuildTarget, taskName?: string): vscode.Task | undefined {
        if (target.kind !== this.kind) {
            return undefined;
        }

        return this.taskProvider.getTask(taskName || target.label, target.projectFile, target.taskDefinition);
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

    private collectProject(taskDefinition: FpcTaskDefinition, projectsByFile: Map<string, PascalProject>): void {
        if (!taskDefinition.file) {
            return;
        }

        const cwd = this.workspaceTasks.resolveWorkspacePath(taskDefinition.cwd);
        const projectFile = this.workspaceTasks.resolveWorkspacePath(taskDefinition.file, cwd);
        const project = this.getOrCreateProject(projectFile, taskDefinition, projectsByFile);
        const label = taskDefinition.label || project.label;

        this.addTarget(project, {
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

    private collectDiscoveredProject(projectFile: string, projectsByFile: Map<string, PascalProject>): void {
        const taskDefinition = new FpcTaskDefinition();
        taskDefinition.file = projectFile;
        taskDefinition.cwd = path.dirname(projectFile);
        taskDefinition.buildOption = {
            syntaxMode: 'ObjFPC',
            unitOutputDir: './out'
        };

        const project = this.getOrCreateProject(projectFile, taskDefinition, projectsByFile);
        this.addTarget(project, {
            id: this.createTargetId(projectFile, 'Default'),
            kind: this.kind,
            label: 'Default',
            projectId: project.id,
            projectFile,
            isDefault: false,
            isInProjectFile: true,
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

    private addTarget(project: FpcProjectModel, target: FpcBuildTarget): void {
        if (project.targets.some(candidate => candidate.id === target.id)) {
            return;
        }

        project.targets.push(target);
    }

    private findProjectFiles(root: string): string[] {
        const results: string[] = [];
        this.walkProjectFiles(root, file => {
            if (this.isFpcProjectFile(file) && !this.hasAdjacentLazarusProject(file)) {
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

    private isFpcProjectFile(file: string): boolean {
        const extension = path.extname(file).toLowerCase();
        return extension === '.lpr' || extension === '.dpr';
    }

    private hasAdjacentLazarusProject(file: string): boolean {
        const directory = path.dirname(file);
        const baseName = path.basename(file, path.extname(file));
        return fs.existsSync(path.join(directory, `${baseName}.lpi`));
    }

    private shouldSkipDirectory(name: string): boolean {
        return ['.git', '.svn', '.hg', '.vscode', 'node_modules', 'out', 'output', 'dist'].includes(name.toLowerCase());
    }
}
