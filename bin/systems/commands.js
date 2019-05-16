const DefaultSystem = require('../system');
const Config = require('../../config');
const Utils = require('../util');
const {DefaultAlias, DefaultCommand} = require('../templates/command');
const fs = require('fs');
const {ErrorMessageResponse} = require('../messageresponse');

/**
 * @typedef {import('./database')} Database
 * @typedef {import('discord.js').Message} DiscordMessage
 */

class CommandSystem extends DefaultSystem {

    constructor(client) {
        super(client, "Commands");

        /** @type {{cmd: DefaultCommand}} */
        this._commands = {};
        this._dbSys = null;
    }

    init() {
        this._manager.on("messageOther", (msg) => this.handleCommand(msg));
        /** @type {Database} */
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
        let cmds = fs.readdirSync('./bin/systems/commands'); //Relative to master
        cmds.forEach((file) => {
            if(file.substr(file.length - 3) == ".js") {
                let cmdClass = require('./commands/' + file); //relative to script
                let cmd = new cmdClass(this._manager);
                cmd.preinit();
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

    /**
     * Registers a new alias command
     * @param {DefaultAlias} alias 
     */
    registerAlias(alias) {
        this._commands[alias._name] = alias;
        this._commands[alias._link._name]._aliases.push(alias._name);
        Utils.log("CommandLoad", `Alias registered '${alias._link._name}' as '${alias._name}'`)
    }

    /**
     * Handles a received discord message.
     * @param {DiscordMessage} msg 
     */
    handleCommand(msg) {
        if(msg.content.startsWith(Config.prefix)) {
            //let regex = /"([^"]*)"|'([^']*)'|```([^`]*)```|([^ "']*[^ "'])/g; //To be used if ``` <stuff> ``` is ever needed
            let regex = /"([^"]*)"|'([^']*)'|([^ "']*[^ "'])/g;
            
            let args = [];
            let match;

            do {
                match = regex.exec(msg.content);
                if(match) {
                    let matchValue;
                    for(let i=match.length; i>0; i-=1) {
                        if(match[i] != null) {
                            matchValue = match[i];
                            break;
                        }
                    }
                    args.push(matchValue);
                }
            } while (match);

            let command = args[0].substr(Config.prefix.length);
            if(this._commands[command] != null) {
                try {
                    args.shift(); //We know the command name, strip it.
                    let cmdOut = this._commands[command].exec(msg, args);
                    cmdOut.generate(msg);
                } catch (e) {
                    Utils.log("CommandError", ":::WARNING::: Command threw error\n", e);
                    (new ErrorMessageResponse("Command failed to execute. Contact the Admins\n```" + e + "```")).generate(msg);
                }
            } else {

            }
        }
    }
}

module.exports = CommandSystem