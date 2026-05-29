import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClientHandle } from '../services/languageClientHandle';
import { WizardDefinition, WizardField, WizardPlan, WizardRequest } from '../wizard/wizardTypes';

const commandCreateWizard = 'nexus.project.createWizard';
const commandPlanCreate = 'nexus.project.planCreate';
const commandCreate = 'nexus.project.create';

interface NexusProjectWizardSeed {
    title?: string;
    request?: WizardRequest;
    fields?: WizardField[];
}

interface NexusProjectWizardPlan extends WizardPlan {
    fields?: WizardField[];
}

interface NexusProjectCreatedFile {
    path: string;
    content: string;
}

interface NexusProjectCreateResult {
    message?: string;
    files?: NexusProjectCreatedFile[];
}

export class NexusProjectRemoteWizardDefinition implements WizardDefinition<WizardRequest, NexusProjectWizardPlan> {
    public readonly id = 'nexusProjectWizard:nexusRemote';
    public readonly title = 'New Nexus Project';
    private seed: NexusProjectWizardSeed | undefined;

    public constructor(
        private readonly languageClient: LanguageClientHandle,
        private readonly workspaceRoot: string
    ) {
    }

    public async getInitialRequest(): Promise<WizardRequest> {
        const seed = await this.getSeed();
        return seed.request || {
            projectName: 'newproject',
            targetDir: this.workspaceRoot
        };
    }

    public async getFields(request: WizardRequest): Promise<WizardField[]> {
        if (!request || Object.keys(request).length === 0) {
            return (await this.getSeed()).fields || [];
        }

        const plan = await this.languageClient.executeCommand<NexusProjectWizardPlan>(commandPlanCreate, [request]);
        return plan.fields || (await this.getSeed()).fields || [];
    }

    public async createPlan(request: WizardRequest): Promise<NexusProjectWizardPlan> {
        return this.languageClient.executeCommand<NexusProjectWizardPlan>(commandPlanCreate, [request]);
    }

    public async execute(request: WizardRequest, _plan: NexusProjectWizardPlan): Promise<void> {
        const result = await this.languageClient.executeCommand<NexusProjectCreateResult>(commandCreate, [request]);
        const files = result.files || [];
        if (files.length === 0) {
            throw new Error('Language server did not return any project files.');
        }

        const writtenUris: vscode.Uri[] = [];
        for (const file of files) {
            if (!file.path) {
                continue;
            }

            const uri = vscode.Uri.file(file.path);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(file.path)));
            await vscode.workspace.fs.writeFile(uri, Buffer.from(file.content || '', 'utf8'));
            writtenUris.push(uri);
        }

        if (writtenUris.length === 0) {
            throw new Error('Language server returned no writable project files.');
        }

        const document = await vscode.workspace.openTextDocument(writtenUris[0]);
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage(result.message || 'Nexus project created.');
    }

    private async getSeed(): Promise<NexusProjectWizardSeed> {
        if (!this.seed) {
            this.seed = await this.languageClient.executeCommand<NexusProjectWizardSeed>(
                commandCreateWizard,
                [this.workspaceRoot]
            );
        }

        return this.seed;
    }
}
