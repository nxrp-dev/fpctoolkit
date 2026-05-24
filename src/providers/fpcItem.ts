import * as vscode from 'vscode';
import * as path from 'path';
import { PascalBuildTarget, PascalProject } from '../model/pascalProject';
import { ProjectType } from './projectType';

export class FpcItem extends vscode.TreeItem {
    constructor(
        public readonly level: number,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly file: string,
        public fileexist: boolean,
        public isDefault: boolean,
        public projectType: ProjectType = ProjectType.FPC,
        public readonly project?: PascalProject,
        public readonly target?: PascalBuildTarget
    ) {
        super(label, collapsibleState);

        if (level === 0) {
            this.contextValue = projectType === ProjectType.Lazarus ? 'lazarusproject' : 'fpcproject';
        } else {
            if (projectType === ProjectType.Lazarus) {
                this.contextValue = 'lazarusbuildmode';
            } else {
                this.contextValue = 'fpcbuild';
            }
        }

        if (this.level > 0) {
            if (this.isDefault) {
                this.description = 'default';
                this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            }
            const command = {
                command: "nexusPascal.project.opensetting",
                title: '',
                arguments: [this]
            };
            this.command = command;
        }

        if (this.level === 0) {
            if (projectType === ProjectType.Lazarus) {
                this.iconPath = path.join(__dirname, '..', 'images', 'lazarus.png');
            } else {
                this.iconPath = path.join(__dirname, '..', 'images', 'pascal-project.png');
            }
        } else if (!this.isDefault) { // Only set these icons if NOT a default task (which already has a check icon)
            if (projectType === ProjectType.Lazarus) {
                this.iconPath = new vscode.ThemeIcon('gear');
            } else {
                this.iconPath = new vscode.ThemeIcon('tools');
            }
        }
    }
}
