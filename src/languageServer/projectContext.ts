export type PascalProjectKind = 'fpc' | 'lazarus';

export interface LanguageServerProjectContext {
    kind: PascalProjectKind;
    label: string;
    projectFile: string;
    workingDirectory: string;
    buildMode?: string;
    fpcOptions: string[];
    allowFpcGlobalUnitPaths: boolean;
}
