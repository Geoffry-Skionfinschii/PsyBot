const fs = require('fs');
const Config = require('../config')
const Utils = require('./util');
const Login = require('../login');
const Process = require('child_process');


class ScriptUtils {
    /**
     * Checks a tmux window named 'window' does not exist, then runs 'exec' under the new 'window'
     * @param {string} window Window Title
     * @param {string} exec Executed in shell as command
     * @returns {true | false | null} False if window already exists, Null if invalid script.
     */
    static runScript(window, exec) {
        let scripts = ScriptUtils.getScripts();
        if(scripts.includes(exec + '.sh'))
            exec = exec + '.sh';
        if (!(scripts.includes(exec))) {
            return null;
        }
        try {
            Process.execSync(`tmux list-windows | grep -q '${window}'`);
        } catch {
            Process.exec(`tmux new-window -n '${window}' './${exec}'`, {cwd: Login.gamescriptDir});
            Utils.log("ScriptUtils", `Started ${exec} in window ${window}`);
            return true;
        }
        return false;
        
    }

    static getScripts() {
        let fileList = fs.readdirSync(Login.gamescriptDir);
        return fileList.filter((val) => val.endsWith('.sh'));
    }

    /**
     * 
     * @param {string} window 
     * @param {string} exec 
     * @returns {true | false}
     */
    static runCommand(window, exec) {
        try {
            Process.execSync(`tmux list-windows | grep -q '${window}'`);
        } catch {
            return false;
        }
        //Window exists, execute
        Process.exec(`tmux send-keys -t '${window}' '${exec}' Enter`);
        Utils.log("ScriptUtils", `Send command ${exec} to window ${window}`);
        return true;
    }
}

module.exports = ScriptUtils;