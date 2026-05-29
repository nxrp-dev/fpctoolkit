import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageServerProjectContext } from './projectContext';
import { createBuildOptionArguments } from '../build/buildOptionArguments';
import { BuildOption, FpcTaskDefinition } from '../providers/taskDefinitions';
export class CompileOption {
    /**
     * Compile Option
     */
    public type: string = "fpc";
    public cwd: string = "";
    public label: string = '';
    public file: string = '';
    public buildOption?:BuildOption;
    private allowBuildOptionCustomOptions = false;


    constructor(

        taskDefinition?: FpcTaskDefinition,
        workspaceRoot?:string

    ) {
        if (taskDefinition) {
            this.file = taskDefinition.file??"";
            this.label = taskDefinition.file??"untitled";
            this.buildOption = taskDefinition.buildOption;
            this.allowBuildOptionCustomOptions = taskDefinition.isLazarusBuildMode === true;
            if(workspaceRoot){
                if (taskDefinition.cwd) {
                    let rawCwd = taskDefinition.cwd;
                    if (rawCwd.includes('${workspaceFolder}')) {
                        this.cwd = rawCwd.replace(/\$\{workspaceFolder\}/g, workspaceRoot);
                    } else if (path.isAbsolute(rawCwd)) {
                        this.cwd = rawCwd;
                    } else {
                        this.cwd = path.join(workspaceRoot, rawCwd);
                    }
                } else {
                    this.cwd = workspaceRoot;
                }
            }else{
                this.cwd=taskDefinition.cwd??"";
            }
           

        } else {
            this.buildOption = {
                unitOutputDir: "./out"
            };
        }


    }

    toOptionArray(): string[] {
        return createBuildOptionArguments(this.cwd, this.buildOption, {
            includeCustomOptions: this.allowBuildOptionCustomOptions
        });
    }

    toOptionString(): string {
        return this.toOptionArray().join(' ');
    }

}
export class InitializationOptions {
    //current work path
    public cwd: string | undefined;
    // Path to the main program file for resolving references
    // if not available the path of the current document will be used
    public program: string | undefined;
    // Path to SQLite3 database for symbols
    public symbolDatabase: string | undefined;
    // FPC compiler options (passed to Code Tools)
    public fpcOptions: Array<string> = [];
    // syntax will be checked when file opens or saves
    public checkSyntax: boolean | undefined;
    // syntax errors will be published as diagnostics
    public publishDiagnostics: boolean | undefined;
    // syntax errors as shown in the UI with ‘window/showMessage’
    public showSyntaxErrors: boolean | undefined;
    // ignores completion items like "begin" and "var" which may interfer with IDE snippets
    public ignoreTextCompletions: boolean | undefined;

    // enable features in client profile
    //'flatSymbolMode'                 force flat symbol mode (SymbolInformation[])
    //'excludeSectionContainers'       don't include interface/implementation section containers
    //'excludeInterfaceMethodDecls'    don't include method/function/procedure declarations from interface section
    //'excludeImplClassDefs'           don't include class definitions from implementation section
    //'nullDocumentVersion'            use nil instead of 0 for document version
    //'filterTextOnly'                 only set filterText in completion, not label
    public clientProfileEnableFeatures: Array<string> = ['nullDocumentVersion'];

    constructor() {
        let cfg = vscode.workspace.getConfiguration('nexusPascal.languageServer.initializationOptions');
        this.fpcOptions = cfg.get<Array<string>>("fpcOptions", []);
        this.checkSyntax = cfg.get<boolean>('checkSyntax');
        this.publishDiagnostics = cfg.get<boolean>('publishDiagnostics');
        this.showSyntaxErrors = cfg.get<boolean>('showSyntaxErrors');
        this.ignoreTextCompletions = cfg.get<boolean>('ignoreTextCompletions');
    }
    public updateByCompileOption(opt: CompileOption) {
        this.cwd = opt.cwd;
        if (opt.file && !path.isAbsolute(opt.file) && opt.cwd) {
            this.program = path.join(opt.cwd, opt.file);
        } else {
            this.program = opt.file;
        }
        let fpcOptions: Array<string> = this.fpcOptions;
        let newopt = opt.toOptionArray();
        newopt.forEach((s) => {
            //if (s.startsWith('-Fi') || s.startsWith('-Fu') || s.startsWith('-d') || s.startsWith('-M')) {
            if (!s.startsWith('-v')) { //-v will raise error ,hide it 
                fpcOptions.push(s);
            }
        });

    }

    public updateByProjectContext(context: LanguageServerProjectContext) {
        this.cwd = context.workingDirectory;
        this.program = context.projectFile;

        for (const option of context.fpcOptions) {
            if (option && !this.fpcOptions.includes(option)) {
                this.fpcOptions.push(option);
            }
        }
    }
}
