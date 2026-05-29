import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionPaths } from '../services/extensionPaths';

export interface ServerExecutableInfo {
    executable: string;
    targetOS: string;
    targetCPU: string;
}

export class ServerExecutableResolver {
    public constructor(private readonly extensionPaths: ExtensionPaths) {
    }

    public resolve(): ServerExecutableInfo {
        const platform = process.platform;
        const arch = process.arch;
        let bundledServerRelativePath: string;
        let targetCPU: string;
        let targetOS: string;

        if (arch === 'x64') {
            targetCPU = 'x86_64';
            if (platform === 'win32') {
                targetOS = 'win64';
            } else if (platform === 'linux') {
                targetOS = 'linux';
            } else if (platform === 'darwin') {
                targetOS = 'darwin';
            } else {
                throw new Error('Invalid platform');
            }
        } else if (arch === 'arm64') {
            targetCPU = 'aarch64';
            if (platform === 'linux') {
                targetOS = 'linux';
            } else if (platform === 'darwin') {
                targetOS = 'darwin';
            } else if (platform === 'win32') {
                targetOS = 'win64';
                targetCPU = 'x86_64';
            } else {
                throw new Error('Invalid platform');
            }
        } else {
            throw new Error('Invalid architecture');
        }

        bundledServerRelativePath = path.join(
            `${targetCPU}-${targetOS}`,
            platform === 'win32' ? 'nexusls.exe' : 'nexusls'
        );

        return {
            executable: path.resolve(this.extensionPaths.getFilePath('bin'), bundledServerRelativePath),
            targetOS,
            targetCPU
        };
    }
}

export function prepareServerExecutable(executable: string, logger: vscode.OutputChannel): boolean {
    logger.appendLine(`Testing executable at: ${executable}`);

    if (!fs.existsSync(executable)) {
        logger.appendLine(`Error: Language server binary not found at ${executable}`);
        return false;
    }

    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(executable, 0o755);
        } catch (error) {
            logger.appendLine(`Warning: Failed to set permissions on ${executable}: ${error}`);
        }

        if (process.platform === 'darwin') {
            try {
                cp.execSync(`xattr -cr "${executable}"`, { stdio: 'ignore' });
            } catch {
            }
        }
    }

    return true;
}
