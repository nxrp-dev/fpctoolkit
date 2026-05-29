import { PascalBuildTarget, PascalProject } from '../model/pascalProject';
import { PascalProjectAdapterRegistry } from '../projectTypes/pascalProjectAdapter';

export class PascalProjectModelService {
    public constructor(private readonly adapters: PascalProjectAdapterRegistry) {
    }

    public loadProjects(): PascalProject[] {
        const projectsByFile = new Map<string, PascalProject>();

        for (const adapter of this.adapters.all()) {
            adapter.collectProjects({ projectsByFile });
        }

        const projects = Array.from(projectsByFile.values());
        this.applyDefaultTarget(projects);
        return projects;
    }

    public getDefaultTarget(projects: PascalProject[] = this.loadProjects()): PascalBuildTarget | undefined {
        for (const project of projects) {
            const target = project.targets.find(candidate => candidate.isDefault);
            if (target) {
                return target;
            }
        }

        return projects[0]?.targets[0];
    }

    private applyDefaultTarget(projects: PascalProject[]): void {
        let defaultTarget = this.getExplicitDefaultTarget(projects);

        if (!defaultTarget) {
            defaultTarget = projects[0]?.targets[0];
        }

        for (const project of projects) {
            project.isDefault = false;
            for (const target of project.targets) {
                target.isDefault = target === defaultTarget;
                if (target.isDefault) {
                    project.isDefault = true;
                }
            }
        }
    }

    private getExplicitDefaultTarget(projects: PascalProject[]): PascalBuildTarget | undefined {
        for (const project of projects) {
            const target = project.targets.find(candidate => candidate.isDefault);
            if (target) {
                return target;
            }
        }

        return undefined;
    }
}
