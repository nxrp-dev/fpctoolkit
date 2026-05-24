import * as vscode from 'vscode';
import { PascalBuildTarget, PascalProject } from '../model/pascalProject';
import { FpcItem } from '../providers/fpcItem';
import { ProjectType } from '../providers/projectType';

export class PascalProjectTreeFactory {
    public createProjectItem(project: PascalProject): FpcItem {
        return new FpcItem(
            0,
            project.label,
            vscode.TreeItemCollapsibleState.Expanded,
            project.file,
            project.fileExists,
            project.isDefault,
            this.getProjectType(project),
            project
        );
    }

    public createTargetItem(project: PascalProject, target: PascalBuildTarget): FpcItem {
        return new FpcItem(
            1,
            target.label,
            vscode.TreeItemCollapsibleState.None,
            project.file,
            project.fileExists,
            target.isDefault,
            this.getProjectType(project),
            project,
            target
        );
    }

    public getProjectType(project: PascalProject): ProjectType {
        return project.kind === 'lazarus' ? ProjectType.Lazarus : ProjectType.FPC;
    }
}
