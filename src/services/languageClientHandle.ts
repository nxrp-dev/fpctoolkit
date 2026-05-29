import * as vscode from 'vscode';
import { PascalLanguageClientService } from '../languageServer/client';

export class LanguageClientHandle {
    private client?: PascalLanguageClientService;

    public get current(): PascalLanguageClientService | undefined {
        return this.client;
    }

    public set(client: PascalLanguageClientService | undefined): void {
        this.client = client;
    }

    public async restart(): Promise<void> {
        await this.client?.restart();
    }

    public async completeCode(editor: vscode.TextEditor): Promise<void> {
        await this.client?.doCodeComplete(editor);
    }

    public async executeCommand<T = unknown>(command: string, args: unknown[] = []): Promise<T> {
        if (!this.client) {
            throw new Error('Language server is not available.');
        }

        return this.client.executeCommand<T>(command, args);
    }
}
