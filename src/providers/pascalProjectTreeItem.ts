import * as vscode from 'vscode';
import { PascalBuildTarget, PascalProject, PascalProjectKind } from '../model/pascalProject';

export type PascalProjectTreeNodeKind = 'project' | 'target';

export class PascalProjectTreeItem extends vscode.TreeItem {
    public readonly level: number;

    public constructor(
        public readonly nodeKind: PascalProjectTreeNodeKind,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly file: string,
        public fileexist: boolean,
        public isDefault: boolean,
        public projectKind: PascalProjectKind,
        contextValue: string,
        iconPath: vscode.ThemeIcon | string | undefined,
        public readonly project?: PascalProject,
        public readonly target?: PascalBuildTarget
    ) {
        super(label, collapsibleState);

        this.level = nodeKind === 'project' ? 0 : 1;
        this.contextValue = contextValue;
        this.iconPath = iconPath;

        if (this.nodeKind === 'target') {
            if (this.isDefault) {
                this.description = 'default';
            }

            if (this.target?.canBuild) {
                this.command = {
                    command: 'nexusPascal.project.opensetting',
                    title: '',
                    arguments: [this]
                };
            }
        }
    }
}
