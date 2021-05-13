import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');

async function translateDirectoryPath(bashPath: string, directoryPath: string): Promise<string> {
    let bashPwd = tl.tool(bashPath)
        .arg('--noprofile')
        .arg('--norc')
        .arg('-c')
        .arg('pwd');

    let bashPwdOptions = <tr.IExecOptions>{
        cwd: directoryPath,
        failOnStdErr: true,
        errStream: process.stdout,
        outStream: process.stdout,
        ignoreReturnCode: false
    };
    let pwdOutput = '';
    bashPwd.on('stdout', (data) => {
        pwdOutput += data.toString();
    });
    await bashPwd.exec(bashPwdOptions);
    pwdOutput = pwdOutput.trim();
    if (!pwdOutput) {
        throw new Error("Traslate Path failed");
    }

    return `${pwdOutput}`;
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'index.js'));

        let filePath: string = path.join(__dirname, "script.sh");
        let bashPath: string = tl.which('bash', true);

        // Translate the script file path from Windows to the Linux file system.
        if (process.platform == 'win32') {
            filePath = await translateDirectoryPath(bashPath, __dirname) + '/script.sh';
        }

        let bash = tl.tool(bashPath)
            .arg('--noprofile')
            .arg('--norc')
            .arg(filePath)
            .arg("World");

        let options = <tr.IExecOptions>{
            cwd: __dirname,
            failOnStdErr: false,
            errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
            outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
            ignoreReturnCode: true
        };

        process.on("SIGINT", () => {
            tl.debug('Started cancellation of executing script');
            bash.killChildProcess();
        });

        // Listen for stderr.
        let stderrFailure = false;
        const aggregatedStderr: string[] = [];
        bash.on('stderr', (data: Buffer) => {
            stderrFailure = true;
            aggregatedStderr.push(data.toString('utf8'));
        });

        // Run bash.
        let exitCode: number = await bash.exec(options);

        let result = tl.TaskResult.Succeeded;

        // Fail on exit code.
        if (exitCode !== 0) {
            tl.error("exited with error");
            result = tl.TaskResult.Failed;
        }

        // Fail on stderr.
        if (stderrFailure) {
            tl.error("exited with error");
            aggregatedStderr.forEach((err: string) => {
                tl.error(err);
            });
            result = tl.TaskResult.Failed;
        }

        tl.setResult(result, null, true);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed', true);
    }
}

run();