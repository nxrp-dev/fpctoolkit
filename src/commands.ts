import * as vscode from 'vscode';
import { LanguageServerCommandHandler } from './commandHandlers/languageServerCommandHandler';
import { TemplateCommandHandler } from './commandHandlers/templateCommandHandler';
import { LanguageClientHandle } from './services/languageClientHandle';
import { WorkspaceTasksService } from './services/workspaceTasksService';
import { ExtensionPaths } from './services/extensionPaths';

export class FpcCommandManager {
    private readonly templateCommands: TemplateCommandHandler;
    private readonly languageServerCommands: LanguageServerCommandHandler;

    public constructor(
        workspaceRoot: string,
        extensionPaths: ExtensionPaths,
        workspaceTasks: WorkspaceTasksService,
        languageClient: LanguageClientHandle
    ) {
        this.templateCommands = new TemplateCommandHandler(workspaceRoot, extensionPaths, workspaceTasks);
        this.languageServerCommands = new LanguageServerCommandHandler(languageClient);
    }

    public registerAll(context: vscode.ExtensionContext): void {
        this.templateCommands.register(context);
        this.languageServerCommands.register(context);
    }
}
