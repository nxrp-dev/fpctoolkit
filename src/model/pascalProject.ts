import { FpcTaskDefinition, LazarusTaskDefinition } from '../providers/taskDefinitions';

export type PascalProject = FpcProjectModel | LazarusProjectModel;
export type PascalBuildTarget = FpcBuildTarget | LazarusBuildTarget;

export interface BasePascalProject {
    id: string;
    label: string;
    file: string;
    fileExists: boolean;
    isDefault: boolean;
    targets: PascalBuildTarget[];
}

export interface FpcProjectModel extends BasePascalProject {
    kind: 'fpc';
    targets: FpcBuildTarget[];
}

export interface LazarusProjectModel extends BasePascalProject {
    kind: 'lazarus';
    targets: LazarusBuildTarget[];
}

export interface BasePascalBuildTarget {
    id: string;
    label: string;
    projectId: string;
    projectFile: string;
    isDefault: boolean;
    isInProjectFile: boolean;
}

export interface FpcBuildTarget extends BasePascalBuildTarget {
    kind: 'fpc';
    taskDefinition: FpcTaskDefinition;
}

export interface LazarusBuildTarget extends BasePascalBuildTarget {
    kind: 'lazarus';
    buildMode?: string;
    cwd: string;
    taskDefinition?: LazarusTaskDefinition;
}
