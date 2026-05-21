import * as path from 'path';
import { IProjectIntf, IProjectTask } from './projectIntf';

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
}
