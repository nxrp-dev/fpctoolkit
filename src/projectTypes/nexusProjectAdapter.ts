import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CompileOption } from '../languageServer/options';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { NexusProjectModel, PascalBuildTarget, PascalProject } from '../model/pascalProject';
import { PascalProjectAdapter, ProjectCollection } from './pascalProjectAdapter';

interface NexusProjectDescriptor {
    name?: string;
}

export class NexusProjectAdapter implements PascalProjectAdapter {
    public readonly kind = 'nexus' as const;

    public constructor(private readonly workspaceRoot: string) {
    }

    public collectProjects(collection: ProjectCollection): void {
        for (const descriptorFile of this.findDescriptorFiles(this.workspaceRoot)) {
            const project = this.createProject(descriptorFile);
            collection.projectsByFile.set(project.id, project);
        }
    }

    public createTask(_target: PascalBuildTarget, _taskName?: string): vscode.Task | undefined {
        return undefined;
    }

    public createCompileOption(_target: PascalBuildTarget | undefined): CompileOption {
        return new CompileOption();
    }

    public createLanguageServerContext(target: PascalBuildTarget | undefined): LanguageServerProjectContext {
        return {
            kind: this.kind,
            label: target?.label || '',
            projectFile: '',
            workingDirectory: target ? this.getProjectRoot(target.projectFile) : this.workspaceRoot,
            fpcOptions: [],
            allowFpcGlobalUnitPaths: true
        };
    }

    public getProjectContextValue(_project: PascalProject): string {
        return 'nexusproject';
    }

    public getTargetContextValue(_target: PascalBuildTarget): string {
        return 'nexustarget';
    }

    public getProjectIcon(_project: PascalProject): vscode.ThemeIcon | string | undefined {
        return new vscode.ThemeIcon('symbol-namespace');
    }

    public getTargetIcon(target: PascalBuildTarget): vscode.ThemeIcon | string | undefined {
        if (target.isDefault) {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        }

        return new vscode.ThemeIcon('circle-large-outline');
    }

    private createProject(descriptorFile: string): NexusProjectModel {
        const projectRoot = this.getProjectRoot(descriptorFile);
        const descriptor = this.readDescriptor(descriptorFile);
        const label = descriptor.name?.trim() || path.basename(projectRoot);

        return {
            id: descriptorFile,
            kind: this.kind,
            label,
            file: descriptorFile,
            descriptorFile,
            fileExists: fs.existsSync(descriptorFile),
            isDefault: false,
            targets: [
                {
                    id: `${descriptorFile}::Project`,
                    kind: this.kind,
                    label: 'Project',
                    projectId: descriptorFile,
                    projectFile: descriptorFile,
                    descriptorFile,
                    isDefault: false,
                    isInProjectFile: true,
                    canBuild: false
                }
            ]
        };
    }

    private readDescriptor(descriptorFile: string): NexusProjectDescriptor {
        try {
            const content = fs.readFileSync(descriptorFile, 'utf8');
            const parsed = JSON.parse(content);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    private getProjectRoot(descriptorFile: string): string {
        return path.dirname(descriptorFile);
    }

    private findDescriptorFiles(root: string): string[] {
        const results: string[] = [];
        this.walkDirectories(root, directory => {
            const baseName = path.basename(directory).toLowerCase();
            if (baseName === '.nexus') {
                const descriptorFile = path.join(directory, 'project.json');
                if (fs.existsSync(descriptorFile)) {
                    results.push(descriptorFile);
                }
                return;
            }

            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.nxp') {
                    results.push(path.join(directory, entry.name));
                }
            }
        });
        return results;
    }

    private walkDirectories(root: string, callback: (directory: string) => void): void {
        if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
            return;
        }

        callback(root);
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || this.shouldSkipDirectory(entry.name)) {
                continue;
            }

            this.walkDirectories(path.join(root, entry.name), callback);
        }
    }

    private shouldSkipDirectory(name: string): boolean {
        return ['.git', '.svn', '.hg', 'node_modules', 'out', 'output', 'dist'].includes(name.toLowerCase());
    }
}
