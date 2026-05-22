import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { IProjectIntf, IProjectTask } from './projectIntf';

export interface LazarusBuildModeInfo {
    name: string;
    isDefault: boolean;
}

export class LazarusProject implements IProjectIntf {
    public label: string;
    public file: string;
    public tasks: IProjectTask[] = [];

    public constructor(label: string, file: string) {
        this.label = label;
        this.file = file;
    }

    public static fromFile(AFile: string): LazarusProject {
        const lName = path.basename(AFile, path.extname(AFile));
        return new LazarusProject(lName, AFile);
    }

    public static readBuildModes(AFile: string): LazarusBuildModeInfo[] {
        if (!fs.existsSync(AFile) || path.extname(AFile).toLowerCase() !== '.lpi') {
            return [];
        }

        const lParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: ''
        });

        const lContent = fs.readFileSync(AFile, 'utf8');
        const lDocument = lParser.parse(lContent);
        const lItems = LazarusProject.asArray(lDocument?.CONFIG?.ProjectOptions?.BuildModes?.Item);

        return lItems
            .map((AItem: any) => LazarusProject.readBuildMode(AItem))
            .filter((AMode: LazarusBuildModeInfo | undefined): AMode is LazarusBuildModeInfo => AMode !== undefined);
    }

    private static readBuildMode(AItem: any): LazarusBuildModeInfo | undefined {
        const lName = typeof AItem?.Name === 'string' ? AItem.Name.trim() : '';
        if (!lName) {
            return undefined;
        }

        return {
            name: lName,
            isDefault: String(AItem.Default || '').toLowerCase() === 'true'
        };
    }

    private static asArray(AValue: any): any[] {
        if (AValue === undefined || AValue === null) {
            return [];
        }

        return Array.isArray(AValue) ? AValue : [AValue];
    }
}
