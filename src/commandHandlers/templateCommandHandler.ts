import * as vscode from 'vscode';
import { ProjectCreationKind } from '../projectCreation/projectCreationTypes';
import { ProjectCreationService } from '../projectCreation/projectCreationService';
import { NexusProjectRemoteWizardDefinition } from '../projectCreation/nexusProjectRemoteWizardDefinition';
import { ProjectCreationWizardDefinition } from '../projectCreation/projectCreationWizardDefinition';
import { ProjectTemplateManager } from '../providers/projectTemplate';
import { ExtensionPaths } from '../services/extensionPaths';
import { LanguageClientHandle } from '../services/languageClientHandle';
import { WizardPanel } from '../wizard/wizardPanel';

export class TemplateCommandHandler {
    private readonly templateManager: ProjectTemplateManager;
    private readonly projectCreationService: ProjectCreationService;
    private extensionUri: vscode.Uri | undefined;

    public constructor(
        private readonly workspaceRoot: string,
        extensionPaths: ExtensionPaths,
        private readonly languageClient: LanguageClientHandle
    ) {
        this.templateManager = new ProjectTemplateManager(workspaceRoot, extensionPaths);
        this.projectCreationService = new ProjectCreationService(workspaceRoot, this.templateManager);
    }

    public register(context: vscode.ExtensionContext): void {
        this.extensionUri = context.extensionUri;
        this.registerCommand(context, 'nexusPascal.project.newFpcProject', () => this.showProjectWizard('fpc'));
        this.registerCommand(context, 'nexusPascal.project.newLazarusProject', () => this.showProjectWizard('lazarus'));
        this.registerCommand(context, 'nexusPascal.project.newNexusProject', () => this.showProjectWizard('nexus'));
    }

    private registerCommand(
        context: vscode.ExtensionContext,
        command: string,
        handler: (...args: any[]) => unknown
    ): void {
        context.subscriptions.push(vscode.commands.registerCommand(command, handler));
    }

    private showProjectWizard = async (initialKind: ProjectCreationKind): Promise<void> => {
        try {
            const definition = initialKind === 'nexus'
                ? new NexusProjectRemoteWizardDefinition(this.languageClient, this.workspaceRoot)
                : new ProjectCreationWizardDefinition(this.projectCreationService, initialKind);

            await WizardPanel.show(
                this.extensionUri || vscode.Uri.file(this.workspaceRoot),
                definition
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create project: ${error}`);
        }
    };
}
