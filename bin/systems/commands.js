const DefaultSystem = require('../system');
const Config = require('../../config');
const Utils = require('../util');
const {DefaultAlias} = require('../templates/command');
const fs = require('fs');

class CommandSystem extends DefaultSystem {

    constructor(client) {
        super(client, "CommandSystem");
        this._commands = {};
        this._dbSys = null;
    }

    init() {
        this._manager.on("message", (msg) => this.handleCommand(msg));

        this._dbSys = this._manager.getSystem("Database");
        this._dbSys.prepareDatabase("cmd_lists");
        this._dbSys.prepareDatabase("cmd_dynamic_alias");
        //this._dbSys.prepareDatabase("cmd_global_rules");
    }

    //Some commands may rely on initialized systems.
    postinit() {
        this._loadCommands();
    }

    _loadCommands() {
        let relDir = './bin/systems/commands/'
        let cmds = fs.readdirSync(relDir);
        cmds.forEach((file) => {
            if(file.substr(file.length - 3) == ".js") {
                let cmdClass = require(relDir + file);
                let cmd = new cmdClass(this._manager);
                cmd.preinit(this);
                Utils.log("CommandLoad", `Loaded command ${cmd._name}`);
                this._commands[cmd._name] = cmd;
            }
        });
        for(let cmd in this._commands) {
            this._commands[cmd].init();
        }

        //Load database aliases
        Utils.log("CommandLoad", `Started registering database aliases...`);
        let dbAliases = this._dbSys.getDatabase("cmd_dynamic_alias")._data;
        for(let alias in dbAliases) {
            let aliasDat = dbAliases[alias];
            this.registerAlias(new DefaultAlias(aliasDat.name, this._commands[aliasDat.link]));
        }
    }

    registerAlias(alias) {
        this._commands[alias._name] = alias;
        this._commands[alias._link._name].aliases.push(alias._name);
        Utils.log("CommandLoad", `Alias registered '${alias._link._name}' as '${alias._name}'`)
    }

    handleCommand(msg) {
        if(msg.content.startsWith(Config.prefix)) {

        }
    }
}

module.exports = CommandSystem