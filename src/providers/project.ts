import * as vscode from 'vscode';
import * as path from 'path';
import { clearTimeout } from 'timers';
import { CompileOption } from '../languageServer/options';
import { PascalBuildTarget, PascalProject } from '../model/pascalProject';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { PascalBuildTargetContextFactory } from '../services/pascalBuildTargetContextFactory';
import { PascalProjectModelService } from '../services/pascalProjectModelService';
import { PascalProjectTreeFactory } from '../services/pascalProjectTreeFactory';
import { FpcTaskProvider } from '../vscode/vscodeTaskProvider';
import { PascalProjectTreeItem } from './pascalProjectTreeItem';
import { PascalProjectKind } from '../model/pascalProject';

export class PascalProjectExplorerProvider implements vscode.TreeDataProvider<PascalProjectTreeItem> {

    private readonly _onDidChangeTreeData: vscode.EventEmitter<PascalProjectTreeItem | undefined | void> = new vscode.EventEmitter<PascalProjectTreeItem | undefined | void>();
    public readonly onDidChangeTreeData: vscode.Event<PascalProjectTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private readonly watch: vscode.FileSystemWatcher;
    private readonly watchSource: vscode.FileSystemWatcher;
    private readonly watchProjectDescriptors: vscode.FileSystemWatcher;
    private defaultCompileOption?: CompileOption = undefined;
    private timeout?: NodeJS.Timeout = undefined;
    private _hasSourceFileChanged = false;

    public defaultProjectItem?: PascalProjectTreeItem = undefined;

    public constructor(
        private readonly workspaceRoot: string,
        private readonly taskProvider: FpcTaskProvider,
        private readonly projectModelService: PascalProjectModelService,
        private readonly buildTargetContextFactory: PascalBuildTargetContextFactory,
        private readonly treeFactory: PascalProjectTreeFactory,
        private readonly projectKindFilter?: PascalProjectKind
    ) {
        this.watch = vscode.workspace.createFileSystemWatcher(path.join(workspaceRoot, '.vscode', 'tasks.json'), false);
        this.watch.onDidChange(() => {
            this.taskProvider.clean();
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

        this.watchProjectDescriptors = vscode.workspace.createFileSystemWatcher(
            '**/{nexus.project.json,project.nexus.json,.nexus/project.json}',
            false,
            false,
            false
        );
        this.watchProjectDescriptors.onDidChange(() => this.refresh());
        this.watchProjectDescriptors.onDidCreate(() => this.refresh());
        this.watchProjectDescriptors.onDidDelete(() => this.refresh());
    }

    public hasSourceFileChanged(): boolean {
        return this._hasSourceFileChanged;
    }

    public resetSourceFileChanged(): void {
        this._hasSourceFileChanged = false;
    }

    public async ensureDefaultProjectItem(): Promise<PascalProjectTreeItem | undefined> {
        if (this.defaultProjectItem) {
            return this.defaultProjectItem;
        }

        const projects = this.getFilteredProjects();
        const defaultTarget = await this.ensureDefaultTarget(projects);
        if (!defaultTarget) {
            return undefined;
        }

        const project = projects.find(candidate => candidate.id === defaultTarget.projectId);
        if (!project) {
            return undefined;
        }

        this.defaultProjectItem = this.treeFactory.createTargetItem(project, defaultTarget);
        return this.defaultProjectItem;
    }

    public async ensureDefaultTarget(projects: PascalProject[] = this.getFilteredProjects()): Promise<PascalBuildTarget | undefined> {
        return this.projectModelService.getDefaultTarget(projects);
    }

    public dispose(): void {
        this.watch?.dispose();
        this.watchSource?.dispose();
        this.watchProjectDescriptors?.dispose();
    }

    public refresh(): void {
        this.defaultProjectItem = undefined;
        this._onDidChangeTreeData.fire();
    }

    public async checkDefaultAndRefresh(): Promise<void> {
        const oldCompileOption = this.defaultCompileOption;
        if (oldCompileOption === undefined) {
            this.taskProvider.notifyTaskConfigurationChanged();
            this.refresh();
            return;
        }

        const newCompileOption = await this.GetDefaultTaskOption();
        if (oldCompileOption.toOptionString() !== newCompileOption.toOptionString()) {
            this.taskProvider.notifyTaskConfigurationChanged();
        }
        this.refresh();
    }

    public getTreeItem(element: PascalProjectTreeItem): vscode.TreeItem {
        return element;
    }

    public async getChildren(element?: PascalProjectTreeItem): Promise<PascalProjectTreeItem[]> {
        if (element) {
            const items = (element.project?.targets || []).map(target => {
                const item = this.treeFactory.createTargetItem(element.project!, target);

                if (item.isDefault) {
                    this.defaultProjectItem = item;
                }

                return item;
            });

            return items;
        }

        this.defaultProjectItem = undefined;
        return this.getFilteredProjects().map(project => this.treeFactory.createProjectItem(project));
    }

    public async GetDefaultTaskOption(): Promise<CompileOption> {
        const target = this.projectModelService.getDefaultTarget(this.getFilteredProjects());
        const option = this.buildTargetContextFactory.createCompileOption(target);

        this.defaultCompileOption = option;
        return option;
    }

    public async getDefaultLanguageServerContext(): Promise<LanguageServerProjectContext> {
        const target = this.projectModelService.getDefaultTarget(this.getFilteredProjects());
        return this.buildTargetContextFactory.createLanguageServerContext(target);
    }

    private getFilteredProjects(): PascalProject[] {
        return this.projectModelService
            .loadProjects()
            .filter(project => this.projectKindFilter === undefined || this.treeFactory.getProjectKind(project) === this.projectKindFilter);
    }

}
