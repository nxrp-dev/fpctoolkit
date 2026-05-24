import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CompileOption } from '../languageServer/options';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { taskProvider } from './task';
import { clearTimeout } from 'timers';
import { LazarusProject } from './lazarus';
import { IProjectTask } from './projectIntf';
import { FpcTask, FpcTaskProject } from './fpcTaskProject';
import { FpcItem } from './fpcItem';
import { ProjectType } from './projectType';
import { LazarusBuildModeTask } from './lazarusBuildModeTask';

export class FpcProjectProvider implements vscode.TreeDataProvider<FpcItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<FpcItem | undefined | void> = new vscode.EventEmitter<FpcItem | undefined | void>();
    public readonly onDidChangeTreeData: vscode.Event<FpcItem | undefined | void> = this._onDidChangeTreeData.event;
    private watch!: vscode.FileSystemWatcher;
    private watchSource!: vscode.FileSystemWatcher;
    public defaultFpcItem?: FpcItem = undefined;
    private config!: vscode.WorkspaceConfiguration;
    private defaultCompileOption?: CompileOption = undefined;
    private timeout?: NodeJS.Timeout = undefined;
    private _hasSourceFileChanged = false;

    public constructor(
        private workspaceRoot: string,
        context: vscode.ExtensionContext,
        private projectTypeFilter?: ProjectType
    ) {
        this.watch = vscode.workspace.createFileSystemWatcher(path.join(workspaceRoot, '.vscode', 'tasks.json'), false);
        this.watch.onDidChange(() => {
            taskProvider.clean();
            if (this.timeout !== undefined) {
                clearTimeout(this.timeout);
            }
            this.timeout = setTimeout(() => {
                this.checkDefaultAndRefresh();
            }, 1000);
        });
        this.watch.onDidDelete(() => {
            this.refresh();
        });

        this.watchSource = vscode.workspace.createFileSystemWatcher('**/*.{pas,pp,lpr,inc,p,dpr,dpk,lfm}', false, false, false);
        this.watchSource.onDidChange(() => this._hasSourceFileChanged = true);
        this.watchSource.onDidCreate(() => this._hasSourceFileChanged = true);
        this.watchSource.onDidDelete(() => this._hasSourceFileChanged = true);
    }

    public hasSourceFileChanged(): boolean {
        return this._hasSourceFileChanged;
    }

    public resetSourceFileChanged(): void {
        this._hasSourceFileChanged = false;
    }

    public async ensureDefaultFpcItem(): Promise<FpcItem | undefined> {
        return this.defaultFpcItem;
    }

    private resolveWorkspacePath(AValue: string | undefined, ABasePath: string = this.workspaceRoot): string {
        if (!AValue) {
            return ABasePath;
        }

        const lResolved = AValue.replace(/\$\{workspaceFolder\}/g, this.workspaceRoot);

        if (path.isAbsolute(lResolved)) {
            return lResolved;
        }

        return path.resolve(ABasePath, lResolved);
    }

    private collectTaskProjects(AItemMaps: Map<string, FpcItem>): void {
        this.config?.tasks?.forEach((ATaskDefinition: any) => {
            if (ATaskDefinition.type === 'fpc') {
                this.collectFpcTaskProject(ATaskDefinition, AItemMaps);
            } else if (ATaskDefinition.type === 'lazarus') {
                this.collectLazarusTaskProject(ATaskDefinition, AItemMaps);
            }
        });
    }

    private collectFpcTaskProject(ATaskDefinition: any, AItemMaps: Map<string, FpcItem>): void {
        if (this.projectTypeFilter !== undefined && this.projectTypeFilter !== ProjectType.FPC) {
            return;
        }

        if (!ATaskDefinition.file) {
            return;
        }

        const lCwd = this.resolveWorkspacePath(ATaskDefinition.cwd);
        const lAbsolutePath = this.resolveWorkspacePath(ATaskDefinition.file, lCwd);
        const lDisplayName = path.basename(ATaskDefinition.file);
        const lIsDefault = ATaskDefinition.group?.isDefault || false;
        const lExistingItem = AItemMaps.get(lAbsolutePath);

        if (lExistingItem?.project) {
            const lProjectIntf = lExistingItem.project as FpcTaskProject;
            const lTask = new FpcTask(ATaskDefinition.label || lDisplayName, lIsDefault, lProjectIntf, ATaskDefinition);
            (lTask as any).isInLpi = false;
            lProjectIntf.tasks.push(lTask);
            if (lIsDefault) {
                lExistingItem.isDefault = true;
            }
            return;
        }

        const lProjectIntf = new FpcTaskProject(lDisplayName, lAbsolutePath, lIsDefault, ATaskDefinition);

        AItemMaps.set(
            lAbsolutePath,
            new FpcItem(
                0,
                lDisplayName,
                vscode.TreeItemCollapsibleState.Expanded,
                lAbsolutePath,
                fs.existsSync(lAbsolutePath),
                lIsDefault,
                ProjectType.FPC,
                lProjectIntf
            )
        );
    }

    private collectLazarusTaskProject(ATaskDefinition: any, AItemMaps: Map<string, FpcItem>): void {
        if (this.projectTypeFilter !== undefined && this.projectTypeFilter !== ProjectType.Lazarus) {
            return;
        }

        if (!ATaskDefinition.project) {
            return;
        }

        const lCwd = this.resolveWorkspacePath(ATaskDefinition.cwd);
        const lAbsolutePath = this.resolveWorkspacePath(ATaskDefinition.project, lCwd);
        const lDisplayName = path.basename(ATaskDefinition.project);
        const lBuildMode = ATaskDefinition.buildMode || ATaskDefinition.label || 'Default';
        const lIsDefault = ATaskDefinition.group?.isDefault || false;
        let lItem = AItemMaps.get(lAbsolutePath);
        let lProjectIntf = lItem?.project as LazarusProject | undefined;

        if (!lProjectIntf) {
            lProjectIntf = LazarusProject.fromFile(lAbsolutePath);

            lItem = new FpcItem(
                0,
                lDisplayName,
                vscode.TreeItemCollapsibleState.Expanded,
                lAbsolutePath,
                fs.existsSync(lAbsolutePath),
                lIsDefault,
                ProjectType.Lazarus,
                lProjectIntf
            );

            AItemMaps.set(lAbsolutePath, lItem);
        }

        this.addLazarusTask(lProjectIntf, ATaskDefinition.label || lBuildMode, lIsDefault, false, lBuildMode);
        this.addLazarusBuildModesFromProject(lProjectIntf);

        if (lIsDefault && lItem) {
            lItem.isDefault = true;
        }
    }


    private addLazarusTask(
        AProject: LazarusProject,
        ALabel: string,
        AIsDefault: boolean,
        AIsInLpi: boolean,
        ABuildMode?: string
    ): void {
        const lKey = this.getLazarusTaskKey(ALabel, ABuildMode);
        const lExists = AProject.tasks.some(ATask => this.getLazarusTaskKey(ATask.label, (ATask as LazarusBuildModeTask).buildMode) === lKey);

        if (lExists) {
            return;
        }

        AProject.tasks.push(new LazarusBuildModeTask(ALabel, AIsDefault, AIsInLpi, AProject, ABuildMode));
    }

    private addLazarusBuildModesFromProject(AProject: LazarusProject): void {
        for (const lMode of LazarusProject.readBuildModes(AProject.file)) {
            this.addLazarusTask(AProject, lMode.name, false, true, lMode.name);
        }
    }

    private getLazarusTaskKey(ALabel: string, ABuildMode?: string): string {
        return (ABuildMode || ALabel).toLowerCase();
    }

    private applyDefaultProjectLogic(AItemMaps: Map<string, FpcItem>): void {
        if (AItemMaps.size < 1) {
            return;
        }

        let lDefaultTask: IProjectTask | undefined;

        for (const lItem of AItemMaps.values()) {
            if (!lItem.project?.tasks) {
                continue;
            }

            lDefaultTask = lItem.project.tasks.find(ATask => ATask.isDefault);
            if (lDefaultTask) {
                break;
            }
        }

        if (!lDefaultTask) {
            for (const lItem of AItemMaps.values()) {
                if (lItem.project?.tasks && lItem.project.tasks.length > 0) {
                    lDefaultTask = lItem.project.tasks[0];
                    break;
                }
            }
        }

        if (!lDefaultTask) {
            return;
        }

        for (const lItem of AItemMaps.values()) {
            for (const lTask of lItem.project?.tasks || []) {
                lTask.isDefault = false;
            }
        }

        lDefaultTask.isDefault = true;
    }

    public dispose(): void {
        this.watch?.dispose();
        this.watchSource?.dispose();
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public async checkDefaultAndRefresh(): Promise<void> {
        const lOldCompileOption = this.defaultCompileOption;
        if (lOldCompileOption === undefined) {
            taskProvider.refresh();
            this.refresh();
            return;
        }

        const lNewCompileOption = await this.GetDefaultTaskOption();
        if (lOldCompileOption.toOptionString() !== lNewCompileOption.toOptionString()) {
            taskProvider.refresh();
        }
        this.refresh();
    }

    public getTreeItem(AElement: FpcItem): vscode.TreeItem {
        return AElement;
    }

    public async getChildren(AElement?: FpcItem): Promise<FpcItem[]> {
        if (AElement) {
            const lItems: FpcItem[] = [];

            for (const lTask of AElement.project?.tasks || []) {
                const lItem = new FpcItem(
                    1,
                    lTask.label,
                    vscode.TreeItemCollapsibleState.None,
                    AElement.file,
                    AElement.fileexist,
                    lTask.isDefault,
                    AElement.projectType,
                    lTask
                );
                lItems.push(lItem);

                if (lItem.isDefault) {
                    this.defaultFpcItem = lItem;
                }
            }

            return lItems;
        }

        const lItemMaps: Map<string, FpcItem> = new Map();
        this.config = vscode.workspace.getConfiguration('tasks', vscode.Uri.file(this.workspaceRoot));
        this.collectTaskProjects(lItemMaps);
        this.applyDefaultProjectLogic(lItemMaps);
        return Array.from(lItemMaps.values());
    }

    public async GetDefaultTaskOption(): Promise<CompileOption> {
        const lTreeTask = this.defaultFpcItem?.projectTask;
        if (lTreeTask) {
            const lOption = lTreeTask.getCompileOption(this.workspaceRoot);
            this.defaultCompileOption = lOption;
            return lOption;
        }

        const lConfig = vscode.workspace.getConfiguration('tasks', vscode.Uri.file(this.workspaceRoot));
        let lFallbackTask: any | undefined;

        for (const lTaskDefinition of lConfig.get<any[]>('tasks') || []) {
            if (lTaskDefinition.type !== 'fpc' && lTaskDefinition.type !== 'lazarus') {
                continue;
            }

            if (!lFallbackTask) {
                lFallbackTask = lTaskDefinition;
            }

            if (lTaskDefinition.group?.isDefault) {
                const lOption = this.createCompileOptionFromTaskDefinition(lTaskDefinition);
                this.defaultCompileOption = lOption;
                return lOption;
            }
        }

        const lOption = lFallbackTask
            ? this.createCompileOptionFromTaskDefinition(lFallbackTask)
            : new CompileOption();

        this.defaultCompileOption = lOption;
        return lOption;
    }

    public async getDefaultLanguageServerContext(): Promise<LanguageServerProjectContext> {
        const lTreeTask = this.defaultFpcItem?.projectTask;
        if (lTreeTask) {
            return lTreeTask.getLanguageServerContext(this.workspaceRoot);
        }

        const lConfig = vscode.workspace.getConfiguration('tasks', vscode.Uri.file(this.workspaceRoot));
        let lFallbackTask: any | undefined;

        for (const lTaskDefinition of lConfig.get<any[]>('tasks') || []) {
            if (lTaskDefinition.type !== 'fpc' && lTaskDefinition.type !== 'lazarus') {
                continue;
            }

            if (!lFallbackTask) {
                lFallbackTask = lTaskDefinition;
            }

            if (lTaskDefinition.group?.isDefault) {
                return this.createLanguageServerContextFromTaskDefinition(lTaskDefinition);
            }
        }

        return lFallbackTask
            ? this.createLanguageServerContextFromTaskDefinition(lFallbackTask)
            : this.createLanguageServerContextFromCompileOption(new CompileOption());
    }

    private createCompileOptionFromTaskDefinition(ATaskDefinition: any): CompileOption {
        if (ATaskDefinition.type === 'lazarus') {
            const lCwd = this.resolveWorkspacePath(ATaskDefinition.cwd);
            const lProjectFile = this.resolveWorkspacePath(ATaskDefinition.project, lCwd);
            const lOption = new CompileOption();
            lOption.type = 'lazarus';
            lOption.label = ATaskDefinition.label || path.basename(lProjectFile);
            lOption.file = lProjectFile;
            lOption.cwd = path.dirname(lProjectFile);
            lOption.buildOption = undefined;
            return lOption;
        }

        const lDefinition = taskProvider.GetTaskDefinition(ATaskDefinition.label) || ATaskDefinition;
        return new CompileOption(lDefinition, this.workspaceRoot);
    }

    private createLanguageServerContextFromTaskDefinition(ATaskDefinition: any): LanguageServerProjectContext {
        if (ATaskDefinition.type === 'lazarus') {
            const lCwd = this.resolveWorkspacePath(ATaskDefinition.cwd);
            const lProjectFile = this.resolveWorkspacePath(ATaskDefinition.project, lCwd);

            return {
                kind: 'lazarus',
                label: ATaskDefinition.label || path.basename(lProjectFile),
                projectFile: lProjectFile,
                workingDirectory: path.dirname(lProjectFile),
                buildMode: ATaskDefinition.buildMode,
                fpcOptions: [],
                allowFpcGlobalUnitPaths: false
            };
        }

        return this.createLanguageServerContextFromCompileOption(this.createCompileOptionFromTaskDefinition(ATaskDefinition));
    }

    private createLanguageServerContextFromCompileOption(AOption: CompileOption): LanguageServerProjectContext {
        const lFpcOptions = AOption.toOptionString()
            .split(' ')
            .filter(AValue => AValue.length > 0 && !AValue.startsWith('-v'));

        return {
            kind: 'fpc',
            label: AOption.label,
            projectFile: AOption.file,
            workingDirectory: AOption.cwd,
            fpcOptions: lFpcOptions,
            allowFpcGlobalUnitPaths: true
        };
    }
}
