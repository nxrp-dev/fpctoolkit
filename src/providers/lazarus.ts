import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

export interface LazarusBuildModeInfo {
    name: string;
    isDefault: boolean;
}

export function readLazarusBuildModes(file: string): LazarusBuildModeInfo[] {
    if (!fs.existsSync(file) || path.extname(file).toLowerCase() !== '.lpi') {
        return [];
    }

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ''
    });

    const content = fs.readFileSync(file, 'utf8');
    const document = parser.parse(content);
    const items = asArray(document?.CONFIG?.ProjectOptions?.BuildModes?.Item);

    return items
        .map((item: any) => readBuildMode(item))
        .filter((mode: LazarusBuildModeInfo | undefined): mode is LazarusBuildModeInfo => mode !== undefined);
}

function readBuildMode(item: any): LazarusBuildModeInfo | undefined {
    const name = typeof item?.Name === 'string' ? item.Name.trim() : '';
    if (!name) {
        return undefined;
    }

    return {
        name,
        isDefault: String(item.Default || '').toLowerCase() === 'true'
    };
}

function asArray(value: any): any[] {
    if (value === undefined || value === null) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}
