import { WorkspaceTasksService } from '../services/workspaceTasksService';
import { FpcTaskProvider, LazarusTaskProvider } from '../vscode/vscodeTaskProvider';
import { FpcProjectAdapter } from './fpcProjectAdapter';
import { LazarusProjectAdapter } from './lazarusProjectAdapter';
import { NexusProjectAdapter } from './nexusProjectAdapter';
import { PascalProjectAdapterRegistry } from './pascalProjectAdapter';

export function createPascalProjectAdapterRegistry(
    workspaceRoot: string,
    workspaceTasks: WorkspaceTasksService,
    fpcTaskProvider: FpcTaskProvider,
    lazarusTaskProvider: LazarusTaskProvider
): PascalProjectAdapterRegistry {
    const registry = new PascalProjectAdapterRegistry();
    registry.register(new FpcProjectAdapter(workspaceRoot, workspaceTasks, fpcTaskProvider));
    registry.register(new LazarusProjectAdapter(workspaceTasks, lazarusTaskProvider));
    registry.register(new NexusProjectAdapter(workspaceRoot));
    return registry;
}
