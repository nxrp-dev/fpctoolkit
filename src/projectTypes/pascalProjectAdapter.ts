import * as vscode from 'vscode';
import { CompileOption } from '../languageServer/options';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { PascalBuildTarget, PascalProject, PascalProjectKind } from '../model/pascalProject';

export interface ProjectCollection {
    projectsByFile: Map<string, PascalProject>;
}

export interface BuildConfigurationResult {
    created: boolean;
    message?: string;
}

export interface PascalProjectAdapter {
    readonly kind: PascalProjectKind;

    collectProjects(collection: ProjectCollection): void;
    setDefaultTarget(target: PascalBuildTarget): Promise<void>;
    createTask(target: PascalBuildTarget): vscode.Task | undefined;
    createCompileOption(target: PascalBuildTarget | undefined): CompileOption;
    createLanguageServerContext(target: PascalBuildTarget | undefined): LanguageServerProjectContext;

    getProjectContextValue(project: PascalProject): string;
    getTargetContextValue(target: PascalBuildTarget): string;
    getProjectIcon(project: PascalProject): vscode.ThemeIcon | string | undefined;
    getTargetIcon(target: PascalBuildTarget): vscode.ThemeIcon | string | undefined;

    canAddBuildConfiguration(project: PascalProject): boolean;
    buildConfigurationUnavailableMessage(project: PascalProject): string;
    createBuildConfiguration(project: PascalProject, label: string): Promise<BuildConfigurationResult>;
}

export class PascalProjectAdapterRegistry {
    private readonly adapters = new Map<PascalProjectKind, PascalProjectAdapter>();

    public register(adapter: PascalProjectAdapter): void {
        this.adapters.set(adapter.kind, adapter);
    }

    public all(): PascalProjectAdapter[] {
        return Array.from(this.adapters.values());
    }

    public get(kind: PascalProjectKind): PascalProjectAdapter {
        const adapter = this.adapters.get(kind);
        if (!adapter) {
            throw new Error(`Unsupported Pascal project kind: ${kind}`);
        }

        return adapter;
    }

    public tryGet(kind: PascalProjectKind | undefined): PascalProjectAdapter | undefined {
        return kind ? this.adapters.get(kind) : undefined;
    }
}
