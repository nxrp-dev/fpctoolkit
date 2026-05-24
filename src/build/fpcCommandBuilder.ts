import { CompileOption } from '../languageServer/options';
import { BuildMode } from '../vscode/vscodeTaskTypes';
import { FpcTaskDefinition } from '../providers/taskDefinitions';

export interface FpcBuildCommand {
    compilerPath: string;
    args: string[];
}

export class FpcCommandBuilder {
    public createCommand(name: string, file: string, taskDefinition: FpcTaskDefinition, buildMode: BuildMode): FpcBuildCommand {
        let buildOptionString = '';
        let realDefinition = taskDefinition;
        if (realDefinition === undefined) {
            realDefinition = taskDefinition;
        }
        if (realDefinition?.buildOption) {
            const opt = new CompileOption(realDefinition);
            buildOptionString = opt.toOptionString();
        }
        if (!buildOptionString) {
            buildOptionString = '';
        }

        if (!realDefinition) {
            realDefinition = {
                type: 'fpc',
                file: file
            };
        }
        buildOptionString += '-vq ';

        let compilerPath = process.env['PP'];
        if (compilerPath === '') {
            compilerPath = 'fpc';
        }

        const mainFileForCmd = taskDefinition?.file;
        const args = `${mainFileForCmd} ${buildOptionString}`.split(' ');
        if (!taskDefinition?.isLazarusProject && buildMode === BuildMode.rebuild) {
            args.push('-B');
        }

        return {
            compilerPath: compilerPath!,
            args
        };
    }
}
