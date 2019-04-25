const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {SimpleMessageResponse, ErrorMessageResponse, ReactMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const {RichEmbed} = require("discord.js");
const ErrorStrings = require("../../../errors").commands.perms;
const ErrorTargets = require("../../../errors").commands.targets;

/**
 * @typedef {import('discord.js').Guild} DiscordGuild
 */

class PermCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("perms");
        properties.setArgs(1, 4).setFixedPermissions(true);
        properties.forceWhitelist(true);
        properties.addWhitelist("role", "534221293541916672", true);
        properties.setDetails(new CommandDetails(
            `Applys permissions to commands that support dynamic permissions
            The target needs to be mentioned with @ for user/role and # for chat channel
            Exact will be ignored unless targetting a role.
            \`exact == true\` will mean ONLY that role can use the command
            \`exact == false\` will mean any role above or equal can use the command
            Unspecified defaults to exact.
            
            \`perms *\` will list all active dynamic commands.`,
            `<command> <allow/deny> <target> [exact:true/false]\n'*'`
            )
        );
        super(mgr, properties);

        this._cmdSys = this._manager.getSystem("Commands");
        this._dynamicCmds = [];
    }

    init() {
        let cmds = this._cmdSys._commands;
        for(let cmd in cmds) {
            let command = cmds[cmd];
            if(command._isAlias)
                continue;
            if(!command._properties._fixedPermissions) {
                this._dynamicCmds.push(cmd);
            }
        }
    }

    run(message, args) {
        let whitelistable = ["role", "user"];
        let blacklistable = ["channel", "user"];
        if(args[0] == "*") {
            let rich = new RichEmbed();
            rich.setTitle("Dynamic Permission Commands");
            rich.setDescription(`\`${this._dynamicCmds.join("\n")}\``);
            return new SimpleMessageResponse(rich);
        } else {
            if(this._dynamicCmds.includes(args[0])) {
                let command = this._cmdSys._commands[args[0]];
                //Mentions will have @, @& or #. Get 'user' 'role' or 'channel'
                let targetType = this.getTypeFromMention(args[2]);
                if(targetType == false) {
                    return new ErrorMessageResponse(ErrorTargets.unsupportedTarget);
                }
                if(!whitelistable.includes(targetType) && args[1] == "allow" || !blacklistable.includes(targetType)  && args[1] == "deny")
                    return new ErrorMessageResponse(ErrorStrings.unknownFilter);
                    let targetID = args[2].replace(/[\\<>@#&!]/g, "");
                let targetExists = this.checkTypeExists(targetType, targetID, message.guild);
                if(targetExists != true)
                    return targetExists;
                if(args[1] == "allow") {
                    if(whitelistable.includes(targetType)) {
                        let filter = {type: targetType, id: targetID};
                        if(targetType == "role" && (args[3] == 'true' ? true : false)) {
                            filter.exact = args[3] == 'true' ? true : false;
                        }
                        command._properties.addWhitelist(filter.type, filter.id, filter.exact);
                        command._properties.savePermissions(this._manager);
                        if(targetType == "role") {
                            return new SimpleMessageResponse(`Whitelisted '${filter.type}' with target '${args[2]}' (\`exact=${filter.exact}\`) for command '${args[0]}'`);
                        } else {
                            return new SimpleMessageResponse(`Whitelisted '${filter.type}' with target '${args[2]}' for command '${args[0]}'`);
                        }
                        
                    } else {
                        return new ErrorMessageResponse(ErrorStrings.notChannel);
                    }
                } else {
                    if(blacklistable.includes(targetType)) {
                        let filter = {type: targetType, id: targetID};
                        command._properties.addBlacklist(filter.type, filter.id);
                        command._properties.savePermissions(this._manager);
                        return new SimpleMessageResponse(`Blacklisted '${filter.type}' with target '${args[2]}' for command '${args[0]}'`);
                    } else {
                        return new ErrorMessageResponse(ErrorStrings.notRole);
                    }
                }
            } else {
                return new ErrorMessageResponse(ErrorStrings.notDynamic);
            }
        }
        return new SimpleMessageResponse("You shouldn't see this. HMMMMMMMMMMMMMMMMMMMMMM");
    }

    /**
     * 
     * @param {string} type 
     * @param {*} id 
     * @param {DiscordGuild} guild 
     */
    checkTypeExists(type, id, guild) {
        let err = ""
        switch(type) {
            case 'role':
                if(guild.roles.has(id))
                    return true;
                err = new ErrorMessageResponse(ErrorTargets.unknownRole);
            break;
            case 'user':
                if(guild.members.has(id))
                    return true;
                err = new ErrorMessageResponse(ErrorTargets.unknownUser);
            break;
            case 'channel':
                if(guild.channels.has(id))
                    return true;
                err = new ErrorMessageResponse(ErrorTargets.unknownChannel);
            break;
        }
        return err;
    }

    /**
     * 
     * @param {string} mentionStr 
     */
    getTypeFromMention(mentionStr) {
        mentionStr = mentionStr.replace(/[<>]/g, '');
        if(mentionStr.startsWith('@'))
            return 'user';
        if(mentionStr.startsWith('@&'))
            return 'role';
        if(mentionStr.startsWith('#'))
            return 'channel';
        return false;
    }
}

module.exports = PermCommand