import * as path from 'path';
import * as vscode from 'vscode';

export class ExtensionPaths {
    public constructor(private readonly context: vscode.ExtensionContext) {
    }

    public getFilePath(relativePath: string): string {
        return path.resolve(this.context.extensionPath, relativePath);
    }

    public isVsCodeInsiders(): boolean {
        const extensionPath = this.context.extensionPath;
        return extensionPath.includes('.vscode-insiders') ||
            extensionPath.includes('.vscode-server-insiders') ||
            extensionPath.includes('.vscode-exploration') ||
            extensionPath.includes('.vscode-server-exploration');
    }
}
