import * as vscode from 'vscode';
import { PascalBuildTarget, PascalProject, PascalProjectKind } from '../model/pascalProject';
import { PascalProjectTreeItem } from '../providers/pascalProjectTreeItem';
import { PascalProjectAdapterRegistry } from '../projectTypes/pascalProjectAdapter';

export class PascalProjectTreeFactory {
    public constructor(private readonly adapters: PascalProjectAdapterRegistry) {
    }

    public createProjectItem(project: PascalProject): PascalProjectTreeItem {
        const adapter = this.adapters.get(project.kind);
        return new PascalProjectTreeItem(
            'project',
            project.label,
            vscode.TreeItemCollapsibleState.Expanded,
            project.file,
            project.fileExists,
            project.isDefault,
            project.kind,
            adapter.getProjectContextValue(project),
            adapter.getProjectIcon(project),
            project
        );
    }

    public createTargetItem(project: PascalProject, target: PascalBuildTarget): PascalProjectTreeItem {
        const adapter = this.adapters.get(project.kind);
        return new PascalProjectTreeItem(
            'target',
            target.label,
            vscode.TreeItemCollapsibleState.None,
            project.file,
            project.fileExists,
            target.isDefault,
            project.kind,
            adapter.getTargetContextValue(target),
            adapter.getTargetIcon(target),
            project,
            target
        );
    }

    public getProjectKind(project: PascalProject): PascalProjectKind {
        return project.kind;
    }
}
