import { CompileOption } from '../languageServer/options';
import { LanguageServerProjectContext } from '../languageServer/projectContext';
import { PascalBuildTarget } from '../model/pascalProject';
import { PascalProjectAdapterRegistry } from '../projectTypes/pascalProjectAdapter';

export class PascalBuildTargetContextFactory {
    public constructor(private readonly adapters: PascalProjectAdapterRegistry) {
    }

    public createCompileOption(target: PascalBuildTarget | undefined): CompileOption {
        if (!target) {
            return new CompileOption();
        }

        return this.adapters.get(target.kind).createCompileOption(target);
    }

    public createLanguageServerContext(target: PascalBuildTarget | undefined): LanguageServerProjectContext {
        if (!target) {
            return this.createLanguageServerContextFromCompileOption(new CompileOption());
        }

        return this.adapters.get(target.kind).createLanguageServerContext(target);
    }

    private createLanguageServerContextFromCompileOption(option: CompileOption): LanguageServerProjectContext {
        const fpcOptions = option.toOptionArray()
            .filter(value => value.length > 0 && !value.startsWith('-v'));

        return {
            kind: 'fpc',
            label: option.label,
            projectFile: option.file,
            workingDirectory: option.cwd,
            fpcOptions,
            allowFpcGlobalUnitPaths: true
        };
    }
}
