import * as path from 'path';
import * as vscode from 'vscode';
import { CompileOption } from '../languageServer/options';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { PascalBuildTarget, PascalProject, PascalProjectKind } from '../model/pascalProject';
import { PascalBuildTargetContextFactory } from './pascalBuildTargetContextFactory';
import { PascalProjectModelService } from './pascalProjectModelService';
import { FpcTaskProvider } from '../vscode/vscodeTaskProvider';

export class PascalProjectWorkspaceService implements vscode.Disposable {
    private readonly onDidChangeProjectsEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeProjects: vscode.Event<void> = this.onDidChangeProjectsEmitter.event;

    private readonly watch: vscode.FileSystemWatcher;
    private readonly watchSource: vscode.FileSystemWatcher;
    private readonly watchProjectFiles: vscode.FileSystemWatcher;
    private defaultCompileOption?: CompileOption = undefined;
    private timeout?: NodeJS.Timeout = undefined;
    private sourceFileChanged = false;

    public constructor(
        private readonly workspaceRoot: string,
        private readonly taskProvider: FpcTaskProvider,
        private readonly projectModelService: PascalProjectModelService,
        private readonly buildTargetContextFactory: PascalBuildTargetContextFactory,
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
        this.watchSource.onDidChange(() => this.sourceFileChanged = true);
        this.watchSource.onDidCreate(() => this.sourceFileChanged = true);
        this.watchSource.onDidDelete(() => this.sourceFileChanged = true);

        this.watchProjectFiles = vscode.workspace.createFileSystemWatcher('**/*.{lpi,lpk,lpr,dpr,nxp}', false, false, false);
        this.watchProjectFiles.onDidChange(() => this.refresh());
        this.watchProjectFiles.onDidCreate(() => this.refresh());
        this.watchProjectFiles.onDidDelete(() => this.refresh());
    }

    public hasSourceFileChanged(): boolean {
        return this.sourceFileChanged;
    }

    public resetSourceFileChanged(): void {
        this.sourceFileChanged = false;
    }

    public async ensureDefaultTarget(projects: PascalProject[] = this.getFilteredProjects()): Promise<PascalBuildTarget | undefined> {
        return this.projectModelService.getDefaultTarget(projects);
    }

    public dispose(): void {
        this.watch?.dispose();
        this.watchSource?.dispose();
        this.watchProjectFiles?.dispose();
        this.onDidChangeProjectsEmitter.dispose();
    }

    public refresh(): void {
        this.onDidChangeProjectsEmitter.fire();
    }

    public async checkDefaultAndRefresh(): Promise<void> {
        const oldCompileOption = this.defaultCompileOption;
        if (oldCompileOption === undefined) {
            this.notifyTaskConfigurationChanged();
            this.refresh();
            return;
        }

        const newCompileOption = await this.getDefaultTaskOption();
        if (oldCompileOption.toOptionString() !== newCompileOption.toOptionString()) {
            this.notifyTaskConfigurationChanged();
        }
        this.refresh();
    }

    public async getDefaultTaskOption(): Promise<CompileOption> {
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
            .filter(project => this.projectKindFilter === undefined || project.kind === this.projectKindFilter);
    }

    private notifyTaskConfigurationChanged(): void {
        this.taskProvider.notifyTaskConfigurationChanged();
    }
}
