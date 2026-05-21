export class DefaultBuildModeStorage {
    private static instance: DefaultBuildModeStorage;
    private defaultBuildModeId: string = '';
    
    private constructor() {
        this.loadFromGlobalState();
    }
    
    public static getInstance(): DefaultBuildModeStorage {
        if (!DefaultBuildModeStorage.instance) {
            DefaultBuildModeStorage.instance = new DefaultBuildModeStorage();
        }
        return DefaultBuildModeStorage.instance;
    }
    
    public setDefaultBuildMode(buildModeId: string): void {
        this.defaultBuildModeId = buildModeId;
        this.saveToGlobalState();
    }

    public getDefaultBuildMode(): string {
        return this.defaultBuildModeId;
    }

    public isDefaultBuildMode(buildModeId: string): boolean {
        return this.defaultBuildModeId === buildModeId;
    }

    private loadFromGlobalState(): void {
        try {
            const { FpcCommandManager } = require('../commands');
            const context = FpcCommandManager.context;

            const data = context.globalState.get('lazarusDefaultBuildMode');
            if (data && typeof data === 'string') {
                this.defaultBuildModeId = data;
            }
        } catch (error) {
            console.error('Error loading default build mode from global state:', error);
        }
    }

    private saveToGlobalState(): void {
        try {
            const { FpcCommandManager } = require('../commands');
            const context = FpcCommandManager.context;

            context.globalState.update('lazarusDefaultBuildMode', this.defaultBuildModeId);
        } catch (error) {
            console.error('Error saving default build mode to global state:', error);
        }
    }
}
