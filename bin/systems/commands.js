const DefaultSystem = require('../system');
const Config = require('../../config');
const Utils = require('../util');
const {DefaultAlias, DefaultCommand} = require('../templates/command');
const fs = require('fs');
const {ErrorMessageResponse} = require('../messageresponse');
const {RichEmbed} = require('discord.js');

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

        /** @type {{memberID: {callback: Function, expiry: Date, data: any}}} */
        this._contextDemands = {};
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
     * Demands context, next messages will be handled by the callback. Will decay in 1 minute.
     * @typedef {import('discord.js').GuildMember} DiscordMember
     * @param {DiscordMember} member 
     * @param {DefaultCommand} command 
     * @param {Function} callback 
     */
    demandContext(member, command, callback, data, message) {
        this._contextDemands[member.id] = {callback: callback, expiry: Date.now() + 60000, data: data};
        Utils.log("CommandContext", `Registered context for ${command._name} with ${member.user.username}<${member.user.id}>`);
        if(message != null)
            message.react(Config.contextOn);
    }

    /** 
     * Revokes context demand
     * @param {DiscordMember} member
     * @param {DefaultCommand} command
    */
    revokeContext(member, msg) {
        delete this._contextDemands[member.id];
        Utils.log("CommandContext", `Revoked context demand for ${member.user.username}`);
        if(msg != null)
            msg.react(Config.contextOff);
    }

    /**
     * Handles a received discord message.
     * @param {DiscordMessage} msg 
     */
    handleCommand(msg) {
        if(msg.channel.type == "dm") {
            let guild = Utils.getGuild(this._manager._discordClient);
            let member = guild.members.find((member) => member.user.id == msg.author.id);
            msg.member = member;
            if(msg.member == null) {
                Utils.log("HandleCommand", "Could not find member from message dm, ignoring command.");
                msg.channel.send("Hmm, you don't seem to be in my guild. Contact Geo.");
                return;
            }
        }
        if(this._contextDemands[msg.member.id] != null) {
            if(this._contextDemands[msg.member.id].expiry < Date.now() || msg.content.toLowerCase() == "done") {
                if(msg.content.toLowerCase() == 'done')
                    msg.react(Config.contextOff);
                delete this._contextDemands[msg.member.id];
            } else {
                Utils.log("HandleContext", "Passed message through to context handler.");
                let keepContext = false;
                try {
                    keepContext = this._contextDemands[msg.member.id].callback(msg, this._contextDemands[msg.member.id].data, this._manager);
                } catch (e) {
                    Utils.log("HandleContext", "Context threw an error ", e);
                }
                if(!keepContext) {
                    this.revokeContext(msg.member, msg);
                }
                return;
            }
        }

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
                    Utils.log("CommandExec", `${msg.author.username}<${msg.author.id}> ran ${command}${args.length > 0 ? ` with args ${args}` : ``}`);
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