import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as util from '../common/util';

export interface ProjectTemplate {
    name: string;
    sourcePath: string;
}

interface StarterNode {
    name: string;
    sourcePath: string;
    isStarter: boolean;
}

interface StarterPickItem extends vscode.QuickPickItem {
    node?: StarterNode;
    goBack?: boolean;
}

type JsonObject = { [key: string]: any };

export class ProjectTemplateManager {
    private static readonly StarterRoot = 'templates';
    private static readonly ProjectNameToken = '%PROJECT_NAME%';
    private static readonly IgnoredTemplateFiles = new Set(['template.json']);

    constructor(private readonly workspaceRoot: string) {
    }

    public async selectTemplate(): Promise<ProjectTemplate | undefined> {
        const lStarterRoot = this.getStarterRoot();

        if (!lStarterRoot) {
            vscode.window.showWarningMessage('Nexus Pascal starter folder was not found.');
            return undefined;
        }

        let lCurrentPath = lStarterRoot;

        while (true) {
            const lItems = this.getPickItems(lStarterRoot, lCurrentPath);

            if (lCurrentPath !== lStarterRoot) {
                lItems.unshift({ label: '$(arrow-left) Back', goBack: true });
            }

            if (lItems.length === 0) {
                vscode.window.showInformationMessage('No project starters were found in this category.');
                return undefined;
            }

            const lSelected = await vscode.window.showQuickPick(lItems, {
                placeHolder: this.getPickerTitle(lStarterRoot, lCurrentPath)
            });

            if (!lSelected) {
                return undefined;
            }

            if (lSelected.goBack) {
                lCurrentPath = path.dirname(lCurrentPath);
                continue;
            }

            if (!lSelected.node) {
                return undefined;
            }

            if (lSelected.node.isStarter) {
                return {
                    name: lSelected.node.name,
                    sourcePath: lSelected.node.sourcePath
                };
            }

            lCurrentPath = lSelected.node.sourcePath;
        }
    }

    public async getAvailableTemplates(): Promise<ProjectTemplate[]> {
        const lStarterRoot = this.getStarterRoot();

        if (!lStarterRoot) {
            return [];
        }

        return this.findStarters(lStarterRoot);
    }

    public async createProjectFromTemplate(ATemplate: ProjectTemplate, AProjectName?: string, ATargetDir?: string): Promise<void> {
        const lTargetDir = ATargetDir || this.workspaceRoot;
        const lProjectName = AProjectName || 'newproject';
        const lCollisions = this.findCollisions(ATemplate.sourcePath, lTargetDir, lProjectName);

        if (lCollisions.length > 0) {
            const lChoice = await vscode.window.showWarningMessage(
                `${lCollisions.length} file(s) already exist. Overwrite them?`,
                'Overwrite',
                'Cancel'
            );

            if (lChoice !== 'Overwrite') {
                return;
            }
        }

        this.copyStarter(ATemplate.sourcePath, lTargetDir, lProjectName);
        await this.openFirstPascalFile(ATemplate.sourcePath, lTargetDir, lProjectName);
        vscode.window.showInformationMessage(`Project created from starter: ${ATemplate.name}`);
    }

    private getStarterRoot(): string | undefined {
        const lStarterRoot = util.getExtensionFilePath(ProjectTemplateManager.StarterRoot);
        return fs.existsSync(lStarterRoot) && fs.statSync(lStarterRoot).isDirectory() ? lStarterRoot : undefined;
    }

    private getPickItems(AStarterRoot: string, ACurrentPath: string): StarterPickItem[] {
        return this.getChildNodes(ACurrentPath)
            .sort((ALeft, ARight) => this.compareNodes(ALeft, ARight))
            .map((ANode) => ({
                label: ANode.name,
                description: ANode.isStarter ? 'Starter' : 'Category',
                detail: this.getRelativeFriendlyPath(AStarterRoot, ANode.sourcePath),
                node: ANode
            }));
    }

    private getChildNodes(ADirectory: string): StarterNode[] {
        return fs.readdirSync(ADirectory, { withFileTypes: true })
            .filter((AEntry) => AEntry.isDirectory())
            .map((AEntry) => {
                const lSourcePath = path.join(ADirectory, AEntry.name);

                return {
                    name: this.toFriendlyName(AEntry.name),
                    sourcePath: lSourcePath,
                    isStarter: this.isStarterDirectory(lSourcePath)
                };
            });
    }

    private findStarters(ADirectory: string): ProjectTemplate[] {
        const lStarters: ProjectTemplate[] = [];

        for (const lNode of this.getChildNodes(ADirectory)) {
            if (lNode.isStarter) {
                lStarters.push({
                    name: lNode.name,
                    sourcePath: lNode.sourcePath
                });
            } else {
                lStarters.push(...this.findStarters(lNode.sourcePath));
            }
        }

        return lStarters.sort((ALeft, ARight) => ALeft.name.localeCompare(ARight.name));
    }

    private isStarterDirectory(ADirectory: string): boolean {
        return fs.readdirSync(ADirectory, { withFileTypes: true })
            .some((AEntry) => AEntry.isFile() && !this.isIgnoredTemplateFile(AEntry.name));
    }

    private findCollisions(ASourceDir: string, ATargetDir: string, AProjectName: string): string[] {
        const lCollisions: string[] = [];

        this.walkFiles(ASourceDir, (ASourceFile, ARelativePath) => {
            if (this.isMergeableWorkspaceConfig(ARelativePath)) {
                return;
            }

            const lTargetPath = path.join(ATargetDir, this.applyProjectName(ARelativePath, AProjectName));

            if (fs.existsSync(lTargetPath)) {
                lCollisions.push(lTargetPath);
            }
        });

        return lCollisions;
    }

    private copyStarter(ASourceDir: string, ATargetDir: string, AProjectName: string): void {
        this.walkFiles(ASourceDir, (ASourceFile, ARelativePath) => {
            const lRelativeTargetPath = this.applyProjectName(ARelativePath, AProjectName);
            const lTargetPath = path.join(ATargetDir, lRelativeTargetPath);

            if (this.isMergeableWorkspaceConfig(ARelativePath)) {
                this.mergeWorkspaceConfigFile(ASourceFile, lTargetPath, AProjectName);
                return;
            }

            fs.mkdirSync(path.dirname(lTargetPath), { recursive: true });

            if (this.isTextFile(ASourceFile)) {
                const lContent = fs.readFileSync(ASourceFile, 'utf8');
                fs.writeFileSync(lTargetPath, this.applyProjectName(lContent, AProjectName), 'utf8');
                return;
            }

            fs.copyFileSync(ASourceFile, lTargetPath);
        });
    }

    private mergeWorkspaceConfigFile(ASourceFile: string, ATargetFile: string, AProjectName: string): void {
        fs.mkdirSync(path.dirname(ATargetFile), { recursive: true });

        const lSourceContent = this.applyProjectName(fs.readFileSync(ASourceFile, 'utf8'), AProjectName);

        if (!fs.existsSync(ATargetFile)) {
            fs.writeFileSync(ATargetFile, lSourceContent, 'utf8');
            return;
        }

        const lSourceConfig = this.parseJsonConfig(lSourceContent, ASourceFile);
        const lTargetConfig = this.parseJsonConfig(fs.readFileSync(ATargetFile, 'utf8'), ATargetFile);
        const lFileName = path.basename(ATargetFile).toLowerCase();

        if (lFileName === 'tasks.json') {
            this.mergeNamedArray(lTargetConfig, lSourceConfig, 'tasks', 'label');
            if (!lTargetConfig.version) {
                lTargetConfig.version = lSourceConfig.version || '2.0.0';
            }
        } else if (lFileName === 'launch.json') {
            this.mergeNamedArray(lTargetConfig, lSourceConfig, 'configurations', 'name');
            if (!lTargetConfig.version) {
                lTargetConfig.version = lSourceConfig.version || '0.2.0';
            }
        } else {
            throw new Error(`Unsupported workspace config file: ${ATargetFile}`);
        }

        fs.writeFileSync(ATargetFile, `${JSON.stringify(lTargetConfig, null, 4)}\n`, 'utf8');
    }

    private mergeNamedArray(ATarget: JsonObject, ASource: JsonObject, AArrayName: string, AKeyName: string): void {
        const lSourceItems = Array.isArray(ASource[AArrayName]) ? ASource[AArrayName] : [];

        if (!Array.isArray(ATarget[AArrayName])) {
            ATarget[AArrayName] = [];
        }

        for (const lSourceItem of lSourceItems) {
            if (!lSourceItem || typeof lSourceItem !== 'object') {
                continue;
            }

            const lKey = lSourceItem[AKeyName];
            if (typeof lKey !== 'string' || lKey.length === 0) {
                ATarget[AArrayName].push(lSourceItem);
                continue;
            }

            const lExistingIndex = ATarget[AArrayName].findIndex((ATargetItem: any) => {
                return ATargetItem && typeof ATargetItem === 'object' && ATargetItem[AKeyName] === lKey;
            });

            if (AArrayName === 'tasks') {
                this.adjustDefaultTask(ATarget[AArrayName], lSourceItem, lKey);
            }

            if (lExistingIndex >= 0) {
                ATarget[AArrayName][lExistingIndex] = lSourceItem;
            } else {
                ATarget[AArrayName].push(lSourceItem);
            }
        }
    }

    private adjustDefaultTask(ATargetTasks: any[], ASourceTask: any, ASourceLabel: string): void {
        if (!ASourceTask?.group?.isDefault) {
            return;
        }

        const lHasOtherDefault = ATargetTasks.some((ATask) => {
            return ATask?.label !== ASourceLabel &&
                ATask?.group &&
                typeof ATask.group === 'object' &&
                ATask.group.kind === 'build' &&
                ATask.group.isDefault === true;
        });

        if (lHasOtherDefault) {
            delete ASourceTask.group.isDefault;
        }
    }

    private parseJsonConfig(AContent: string, AFileName: string): JsonObject {
        try {
            return JSON.parse(this.toStrictJson(AContent));
        } catch (AError) {
            throw new Error(`Unable to parse ${AFileName}: ${AError}`);
        }
    }

    private toStrictJson(AContent: string): string {
        return this.removeTrailingCommas(this.removeJsonComments(AContent));
    }

    private removeJsonComments(AContent: string): string {
        let lResult = '';
        let lInString = false;
        let lEscaped = false;

        for (let lIndex = 0; lIndex < AContent.length; lIndex++) {
            const lChar = AContent[lIndex];
            const lNext = AContent[lIndex + 1];

            if (lInString) {
                lResult += lChar;

                if (lEscaped) {
                    lEscaped = false;
                } else if (lChar === '\\') {
                    lEscaped = true;
                } else if (lChar === '"') {
                    lInString = false;
                }

                continue;
            }

            if (lChar === '"') {
                lInString = true;
                lResult += lChar;
                continue;
            }

            if (lChar === '/' && lNext === '/') {
                while (lIndex < AContent.length && AContent[lIndex] !== '\n') {
                    lIndex++;
                }
                lResult += '\n';
                continue;
            }

            if (lChar === '/' && lNext === '*') {
                lIndex += 2;
                while (lIndex < AContent.length && !(AContent[lIndex] === '*' && AContent[lIndex + 1] === '/')) {
                    lIndex++;
                }
                lIndex++;
                continue;
            }

            lResult += lChar;
        }

        return lResult;
    }

    private removeTrailingCommas(AContent: string): string {
        let lResult = '';
        let lInString = false;
        let lEscaped = false;

        for (let lIndex = 0; lIndex < AContent.length; lIndex++) {
            const lChar = AContent[lIndex];

            if (lInString) {
                lResult += lChar;

                if (lEscaped) {
                    lEscaped = false;
                } else if (lChar === '\\') {
                    lEscaped = true;
                } else if (lChar === '"') {
                    lInString = false;
                }

                continue;
            }

            if (lChar === '"') {
                lInString = true;
                lResult += lChar;
                continue;
            }

            if (lChar === ',') {
                const lNextNonWhitespace = this.findNextNonWhitespace(AContent, lIndex + 1);
                if (lNextNonWhitespace === '}' || lNextNonWhitespace === ']') {
                    continue;
                }
            }

            lResult += lChar;
        }

        return lResult;
    }

    private findNextNonWhitespace(AContent: string, AStartIndex: number): string | undefined {
        for (let lIndex = AStartIndex; lIndex < AContent.length; lIndex++) {
            if (!/\s/.test(AContent[lIndex])) {
                return AContent[lIndex];
            }
        }

        return undefined;
    }

    private walkFiles(ARootDir: string, ACallback: (ASourceFile: string, ARelativePath: string) => void): void {
        this.walkFilesFrom(ARootDir, ARootDir, ACallback);
    }

    private walkFilesFrom(ARootDir: string, ACurrentDir: string, ACallback: (ASourceFile: string, ARelativePath: string) => void): void {
        for (const lEntry of fs.readdirSync(ACurrentDir, { withFileTypes: true })) {
            const lSourcePath = path.join(ACurrentDir, lEntry.name);

            if (lEntry.isDirectory()) {
                this.walkFilesFrom(ARootDir, lSourcePath, ACallback);
                continue;
            }

            if (lEntry.isFile() && !this.isIgnoredTemplateFile(lEntry.name)) {
                ACallback(lSourcePath, path.relative(ARootDir, lSourcePath));
            }
        }
    }

    private async openFirstPascalFile(ASourceDir: string, ATargetDir: string, AProjectName: string): Promise<void> {
        const lPascalFiles: string[] = [];

        this.walkFiles(ASourceDir, (ASourceFile, ARelativePath) => {
            if (this.isPascalSourceFile(ASourceFile)) {
                lPascalFiles.push(this.applyProjectName(ARelativePath, AProjectName));
            }
        });

        if (lPascalFiles.length === 0) {
            return;
        }

        lPascalFiles.sort((ALeft, ARight) => this.comparePascalFiles(ALeft, ARight));

        const lDocument = await vscode.workspace.openTextDocument(path.join(ATargetDir, lPascalFiles[0]));
        await vscode.window.showTextDocument(lDocument, vscode.ViewColumn.One);
    }

    private compareNodes(ALeft: StarterNode, ARight: StarterNode): number {
        if (ALeft.isStarter !== ARight.isStarter) {
            return ALeft.isStarter ? 1 : -1;
        }

        return ALeft.name.localeCompare(ARight.name);
    }

    private comparePascalFiles(ALeft: string, ARight: string): number {
        const lLeftIsProgram = this.isProgramFile(ALeft);
        const lRightIsProgram = this.isProgramFile(ARight);

        if (lLeftIsProgram !== lRightIsProgram) {
            return lLeftIsProgram ? -1 : 1;
        }

        return ALeft.localeCompare(ARight);
    }

    private isProgramFile(AFilePath: string): boolean {
        const lExtension = path.extname(AFilePath).toLowerCase();
        return lExtension === '.lpr' || lExtension === '.dpr';
    }

    private isMergeableWorkspaceConfig(ARelativePath: string): boolean {
        const lNormalized = ARelativePath.replace(/\\/g, '/').toLowerCase();
        return lNormalized === '.vscode/tasks.json' || lNormalized === '.vscode/launch.json';
    }

    private getPickerTitle(AStarterRoot: string, ACurrentPath: string): string {
        const lRelativePath = path.relative(AStarterRoot, ACurrentPath);

        if (!lRelativePath) {
            return 'Select a project starter category';
        }

        return `Select from ${this.toFriendlyPath(lRelativePath)}`;
    }

    private getRelativeFriendlyPath(AStarterRoot: string, APath: string): string {
        return this.toFriendlyPath(path.relative(AStarterRoot, APath));
    }

    private toFriendlyPath(APath: string): string {
        return APath
            .split(path.sep)
            .filter((APart) => APart.length > 0)
            .map((APart) => this.toFriendlyName(APart))
            .join(' / ');
    }

    private toFriendlyName(AValue: string): string {
        return AValue
            .split(/[-_\s]+/)
            .filter((APart) => APart.length > 0)
            .map((APart) => APart.charAt(0).toUpperCase() + APart.slice(1))
            .join(' ');
    }

    private applyProjectName(AValue: string, AProjectName: string): string {
        return AValue.split(ProjectTemplateManager.ProjectNameToken).join(AProjectName);
    }

    private isIgnoredTemplateFile(AFileName: string): boolean {
        return ProjectTemplateManager.IgnoredTemplateFiles.has(AFileName.toLowerCase());
    }

    private isTextFile(AFilePath: string): boolean {
        const lExtension = path.extname(AFilePath).toLowerCase();

        return [
            '.bat', '.cmd', '.css', '.dpr', '.inc', '.js', '.json', '.lfm', '.lpi', '.lpr',
            '.md', '.pas', '.pp', '.ps1', '.sh', '.sql', '.txt', '.xml', '.yaml', '.yml'
        ].includes(lExtension);
    }

    private isPascalSourceFile(AFilePath: string): boolean {
        const lExtension = path.extname(AFilePath).toLowerCase();
        return ['.lpr', '.dpr', '.pas', '.pp'].includes(lExtension);
    }
}
