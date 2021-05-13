"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const tl = require("azure-pipelines-task-lib/task");
function translateDirectoryPath(bashPath, directoryPath) {
    return __awaiter(this, void 0, void 0, function* () {
        let bashPwd = tl.tool(bashPath)
            .arg('--noprofile')
            .arg('--norc')
            .arg('-c')
            .arg('pwd');
        let bashPwdOptions = {
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
        yield bashPwd.exec(bashPwdOptions);
        pwdOutput = pwdOutput.trim();
        if (!pwdOutput) {
            throw new Error(tl.loc('JS_TranslatePathFailed', directoryPath));
        }
        return `${pwdOutput}`;
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            tl.setResourcePath(path.join(__dirname, 'index.js'));
            let filePath = path.join(__dirname, "script.sh");
            let bashPath = tl.which('bash', true);
            // Translate the script file path from Windows to the Linux file system.
            if (process.platform == 'win32') {
                filePath = (yield translateDirectoryPath(bashPath, __dirname)) + '/script.sh';
            }
            let bash = tl.tool(bashPath)
                .arg('--noprofile')
                .arg('--norc')
                .arg(filePath)
                .arg("World");
            let options = {
                cwd: __dirname,
                failOnStdErr: false,
                errStream: process.stdout,
                outStream: process.stdout,
                ignoreReturnCode: true
            };
            process.on("SIGINT", () => {
                tl.debug('Started cancellation of executing script');
                bash.killChildProcess();
            });
            // Listen for stderr.
            let stderrFailure = false;
            const aggregatedStderr = [];
            bash.on('stderr', (data) => {
                stderrFailure = true;
                aggregatedStderr.push(data.toString('utf8'));
            });
            // Run bash.
            let exitCode = yield bash.exec(options);
            let result = tl.TaskResult.Succeeded;
            // Fail on exit code.
            if (exitCode !== 0) {
                tl.error("exited with error");
                result = tl.TaskResult.Failed;
            }
            // Fail on stderr.
            if (stderrFailure) {
                tl.error("exited with error");
                aggregatedStderr.forEach((err) => {
                    tl.error(err);
                });
                result = tl.TaskResult.Failed;
            }
            tl.setResult(result, null, true);
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed', true);
        }
    });
}
run();
