import * as ChildProcess from 'child_process';
import { TerminalEscape, TE_Style } from '../common/escape';
import { BaseBuildTerminal } from './buildTerminal';

export class FpcBuildTaskTerminal extends BaseBuildTerminal {
    constructor(cwd: string, fpcpath: string) {
        super(cwd, fpcpath);
    }

    protected async executeBuild(): Promise<number> {
        return new Promise<number>((resolve) => {
            this.emit(TerminalEscape.apply({ msg: `${this.fpcpath} ${this.args.join(' ')}\r\n`, style: [TE_Style.Bold] }));
            this.process = ChildProcess.spawn(this.fpcpath, this.args, { cwd: this.cwd });

            this.process.stdout?.on('data', this.stdout.bind(this));
            this.process.stderr?.on('data', this.stderr.bind(this));
            this.process.on('close', async (code) => {
                await this.handleProcessClose(code);
                resolve(code || 0);
            });
        });
    }

    private stdout(data: any) {
        if (typeof data === 'string') {
            this.buffer += data;
        } else {
            this.buffer += data.toString('utf8');
        }
        const end = this.buffer.lastIndexOf('\n');
        if (end !== -1) {
            this.onOutput(this.buffer.substr(0, end));
            this.buffer = this.buffer.substr(end + 1);
        }
    }

    private onOutput(lines: string) {
        const ls = lines.split('\n');

        ls.forEach(line => {
            line = line.trim();
            if (!line) {
                return;
            }

            if (this.parseFpcStyleError(line)) {
                return;
            }

            if (line.startsWith('Error:') || line.startsWith('Fatal:')) {
                this.emit(TerminalEscape.apply({ msg: line, style: [TE_Style.Red] }));
            } else if (line.startsWith('Warning:')) {
                this.emit(TerminalEscape.apply({ msg: line, style: [TE_Style.BrightYellow] }));
            } else if (line.startsWith('Note:') || line.startsWith('Hint:')) {
                this.emit(TerminalEscape.apply({ msg: line, style: [TE_Style.Cyan] }));
            } else {
                this.emit(line);
            }
        });
    }
}
