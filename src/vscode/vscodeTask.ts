import * as vscode from 'vscode';
import { FpcCommandBuilder } from '../build/fpcCommandBuilder';
import { FpcBuildTaskTerminal } from '../terminal/fpcBuildTaskTerminal';
import { LazarusBuildTerminal } from '../terminal/lazarusBuildTerminal';
import { FpcTaskDefinition, LazarusTaskDefinition } from '../providers/taskDefinitions';
import { BuildMode, FPC_TASK_TYPE, LAZARUS_TASK_TYPE } from './vscodeTaskTypes';

export { BuildMode } from './vscodeTaskTypes';

export class FpcTask extends vscode.Task {
    private _BuildMode: BuildMode = BuildMode.normal;
    private readonly commandBuilder = new FpcCommandBuilder();

    public get BuildMode(): BuildMode {
        return this._BuildMode;
    }

    public set BuildMode(value: BuildMode) {
        this._BuildMode = value;
    }

    constructor(cwd: string, name: string, file: string, taskDefinition: FpcTaskDefinition) {
        super(
            taskDefinition,
            vscode.TaskScope.Workspace,
            `${name}`,
            FPC_TASK_TYPE,
            new FpcCustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                const isLazarusProject = taskDefinition?.isLazarusProject;
                const command = this.commandBuilder.createCommand(name, file, taskDefinition, this._BuildMode);
                let terminal: FpcBuildTaskTerminal | LazarusBuildTerminal;

                if (isLazarusProject) {
                    const buildMode = taskDefinition.buildMode || name;
                    terminal = new LazarusBuildTerminal(cwd, command.compilerPath, taskDefinition?.lazarusProjectFile, buildMode);
                    (terminal as LazarusBuildTerminal).forceRebuild = this._BuildMode === BuildMode.rebuild;
                } else {
                    terminal = new FpcBuildTaskTerminal(cwd, command.compilerPath);
                }

                terminal.args = command.args;
                return terminal;
            })
        );
    }
}

export class LazarusTask extends vscode.Task {
    private _BuildMode: BuildMode = BuildMode.normal;

    public get BuildMode(): BuildMode {
        return this._BuildMode;
    }

    public set BuildMode(value: BuildMode) {
        this._BuildMode = value;
    }

    constructor(cwd: string, name: string, taskDefinition: LazarusTaskDefinition) {
        super(
            taskDefinition,
            vscode.TaskScope.Workspace,
            `${name}`,
            LAZARUS_TASK_TYPE,
            new FpcCustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                let fpcpath = process.env['PP'];
                if (!fpcpath) {
                    fpcpath = 'fpc';
                }

                const buildMode = taskDefinition.buildMode || name;
                const terminal = new LazarusBuildTerminal(cwd, fpcpath, taskDefinition.project, buildMode);
                terminal.forceRebuild = taskDefinition.forceRebuild === true || this._BuildMode === BuildMode.rebuild;
                terminal.args = taskDefinition.project ? [taskDefinition.project] : [];
                return terminal;
            })
        );
    }
}

class FpcCustomExecution extends vscode.CustomExecution {
}
