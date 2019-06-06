const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {SimpleMessageResponse, ErrorMessageResponse, ReactMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const Utils = require('../../util');
const {RichEmbed} = require("discord.js");
const ErrorStrings = require("../../../errors").commands.perms;
const ErrorTargets = require("../../../errors").commands.targets;
const ErrorAll = require("../../../config").commands;

/**
 * @typedef {import('discord.js').Guild} DiscordGuild
 * @typedef {import('discord.js').Message} DiscordMessage
 * @typedef {import('../commands')} CommandSystem
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
            
            \`perms \\*\` will list all active dynamic commands.
            
            perms <command> will show permission lists numbered
            perms <command> delete [id] will delete from white/blacklist with the ID of the entry or all if unspecified`,
            "<command> <allow/deny> <target> [exact:true/false]\n<command> ['delete'] [id/'\\*']\n'\\*'"
            )
        );
        super(mgr, properties);
        /** @type {CommandSystem} */
        this._cmdSys = this._manager.getSystem("Commands");
        this._dynamicCmds = [];

        this._whitelistable = ["role", "user"];
        this._blacklistable = ["channel", "user"];
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

    _listDynamics() {
        let rich = new RichEmbed();
        rich.setTitle("Dynamic Permission Commands");
        rich.setDescription(`\`${this._dynamicCmds.join("\n")}\``);
        return new SimpleMessageResponse(rich);
    }

    _doPermission(args, message) {
        
        let command = this._cmdSys._commands[args[0]];
        if(command == null) {
            return new ErrorMessageResponse(ErrorAll.unknown);
        }
        //Mentions will have @, @& or #. Get 'user' 'role' or 'channel'
        let targetType = this.getTypeFromMention(args[2]);
        let targetID = Utils.stripHeaderFromType(args[2]);
        if(this._idToName(targetType, targetID, message.guild) == null)
            targetType = false;
        if(targetType == false) {
            return new ErrorMessageResponse(ErrorTargets.unsupportedTarget);
        }
        if(!this._whitelistable.includes(targetType) && args[1] == "allow" || !this._blacklistable.includes(targetType)  && args[1] == "deny")
            return new ErrorMessageResponse(ErrorStrings.unknownFilter);
        if(args[1] == "allow") {
            return this._doWhitelist(targetType, targetID, args, command);
        } else if(args[1] == "deny") {
            return this._doBlacklist(targetType, targetID, args, command);
        }
    }

    _doWhitelist(targetType, targetID, args, command) {
        if(this._whitelistable.includes(targetType)) {
            let filter = {type: targetType, id: targetID};
            if(targetType == "role" && (args[3] == 'true' ? true : false)) {
                filter.exact = args[3] == 'true' ? true : false;
            }
            let out = command._properties.addWhitelist(filter.type, filter.id, filter.exact);
            command._properties.savePermissions(this._manager);
            if(out == true) {
                return new SimpleMessageResponse(`Whitelist entry already exists!`);
            }
            if(targetType == "role") {
                return new SimpleMessageResponse(`Whitelisted '${filter.type}' with target '${args[2]}' (\`exact=${filter.exact}\`) for command '${args[0]}'`);
            } else {
                return new SimpleMessageResponse(`Whitelisted '${filter.type}' with target '${args[2]}' for command '${args[0]}'`);
            }
            
        } else {
            return new ErrorMessageResponse(ErrorStrings.notChannel);
        }
    }

    _doBlacklist(targetType, targetID, args, command) {
        if(this._blacklistable.includes(targetType)) {
            let filter = {type: targetType, id: targetID};
            let out = command._properties.addBlacklist(filter.type, filter.id);
            command._properties.savePermissions(this._manager);
            if(out == true) {
                return new SimpleMessageResponse(`Blacklist entry already exists!`);
            }
            return new SimpleMessageResponse(`Blacklisted '${filter.type}' with target '${args[2]}' for command '${args[0]}'`);
        } else {
            return new ErrorMessageResponse(ErrorStrings.notRole);
        }
    }

    _showPermissions(args, message) {
        let command = this._cmdSys._commands[args[0]];
        if(command == null) {
            return new ErrorMessageResponse(ErrorAll.unknown);
        }
        let permList = this._getPermissionIDLists(command, message);
        let rich = new RichEmbed();
        rich.setTitle(`Permission Settings for ${args[0]}`)
        let whiteStr = "";
        for(let i in permList.w) {
            whiteStr += `${i}) ${permList.w[i].type} -> ${permList.w[i].id}`
            if(permList.w[i].type == 'role')
                whiteStr += `, ${permList.w[i].exact == true ? 'exact' : 'above'}`;
            whiteStr += "\n";
        }
        rich.addField("Whitelist", `\`${(whiteStr.length > 2) ? whiteStr : "No whitelist entries."}\``)
        let blkStr = "";
        for(let i in permList.b) {
            blkStr += `${i}) ${permList.b[i].type} -> ${permList.b[i].id}\n`
        }
        rich.addField("Blacklist", `\`${(blkStr.length > 2) ? blkStr : "No blacklist entries."}\``)

        let allowed = command.checkProperties(message, null, true);
        rich.setColor(allowed == true ? 0x00FF00 : 0xAA5533);
        rich.setFooter(allowed == true ? "You can use this command" : "You cannot use this command");
        return new SimpleMessageResponse(rich);
    }

    _deletePermission(args, message) {
        /** @type {DefaultCommand} */
        let command = this._cmdSys._commands[args[0]];
        if(args[2] == null) {
            this._showPermissions(args, message).generate(message);
            this._cmdSys.demandContext(message.member, this, PermCommand._contextDeletePerm, command._properties, message);
            return new SimpleMessageResponse("Please reply the entry to delete");
        }
        if(args[2] == "*") {
            command._properties.resetPermissions();
            command._properties.savePermissions(this._manager);
            return new SimpleMessageResponse(`Deleted all permissions for ${args[0]}`)
        } else {
            let num = Number(args[2].substr(1));
            if(num == NaN)
                return new ErrorMessageResponse(ErrorStrings.IDNaN);
            if(args[2].startsWith("W")) {
                if(num > command._properties._whitelist.length - 1)
                    return new ErrorMessageResponse(ErrorStrings.numberOutOfRange);

                command._properties._whitelist.splice(num, 1);
            } else if(args[2].startsWith("B")) {
                if(num > command._properties._blacklist.length - 1)
                    return new ErrorMessageResponse(ErrorStrings.numberOutOfRange);

                command._properties._blacklist.splice(num, 1);
            } else {
                return new ErrorMessageResponse(ErrorStrings.invalidDeleteID);
            }
            command._properties.savePermissions(this._manager);
            return new SimpleMessageResponse(`Deleted permission ${args[2]} from ${args[0]}`);
        }
    }

    _getPermissionIDLists(command, message) {
        let permList = {w: {}, b: {}, a: {}};
        let whitelist = command.getWhitelist();
        let blacklist = command.getBlacklist();
        for(let i in whitelist) {
            let copy = {};
            copy.type = whitelist[i].type;
            if(whitelist[i].exact != null)
                copy.exact = whitelist[i].exact;
            let name = this._idToName(whitelist[i].type, whitelist[i].id, message.guild);
            if(name != null)
                copy.id = name;
            else
                copy.id = whitelist[i].id;
            permList.w[`W${i}`] = copy;
            permList.a[`W${i}`] = whitelist[i];
        }
        for(let i in blacklist) {
            let copy = {};
            copy.type = blacklist[i].type;
            if(blacklist[i].exact != null)
                copy.exact = blacklist[i].exact;
            let name = this._idToName(blacklist[i].type, blacklist[i].id, message.guild)
            if(name != null)
                copy.id = name;
            else
                copy.id = blacklist[i].id
            permList.b[`B${i}`] = copy;
            permList.a[`B${i}`] = whitelist[i];
        }
        return permList;
    }

    /**
     * 
     * @param {*} type 
     * @param {*} id 
     * @param {DiscordGuild} guild
     */
    _idToName(type, id, guild) {
        try {
            switch(type) {
                case 'user':
                    return guild.member(id).nickname == null ? guild.member(id).user.username : guild.member(id).nickname;
                case 'role':
                    return guild.roles.get(id).name;
                case 'channel':
                    return '#' + guild.channels.get(id).name;
            }
        } catch(e) {
            return null;
        }
        return null;
    } 

    /**
     * 
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     * @returns {SimpleMessageResponse} Must return a new MessageResponse
     */
    run(message, args) {
        if(args[0] == "*") {
            return this._listDynamics();
        } 
        if(args[0] == null || this._cmdSys._commands[args[0]] == null) {
            return new ErrorMessageResponse(ErrorStrings.unknownCommand);
        }
        if(args[1] == null) {
            if(!this._dynamicCmds.includes(args[0]))
            (new ErrorMessageResponse(ErrorStrings.notDynamic)).generate(message);
            return this._showPermissions(args, message);
        }
        if(!this._dynamicCmds.includes(args[0])) {
            return new ErrorMessageResponse(ErrorStrings.notDynamic);
        }
        if(args[1] == "delete") {
            return this._deletePermission(args, message);
        } else if (args[1] == "allow" || args[1] == "deny") {
            return this._doPermission(args, message);
        }
        return new ErrorMessageResponse(ErrorStrings.unknownFilter);
    }

    /**
     * 
     * @param {string} mentionStr 
     */
    getTypeFromMention(mentionStr) {
        mentionStr = mentionStr.replace(/[<>]/g, '');
        if(mentionStr.startsWith('@&'))
            return 'role';
        if(mentionStr.startsWith('@'))
            return 'user';
        if(mentionStr.startsWith('#'))
            return 'channel';
        return false;
    }

    /**
     * 
     * @param {DiscordMessage} message 
     * @param {CommandProperty} data 
     */
    static _contextDeletePerm(message, data, manager) {
        let wasError = false;
        let num = Number(message.content.substr(1));
        if(num == NaN)
            new ErrorMessageResponse(ErrorStrings.IDNaN).generate(message);
        if(message.content.startsWith("W")) {
            if(num > data._whitelist.length - 1)
                new ErrorMessageResponse(ErrorStrings.numberOutOfRange).generate(message);

            data._whitelist.splice(num, 1);
        } else if(message.content.startsWith("B")) {
            if(num > data._blacklist.length - 1)
                new ErrorMessageResponse(ErrorStrings.numberOutOfRange).generate(message);

            data._blacklist.splice(num, 1);
        } else {
            new ErrorMessageResponse(ErrorStrings.invalidDeleteID).generate(message);
        }
        if(!wasError) {
            data.savePermissions(manager);
            new ReactMessageResponse().generate(message);
            return false;
        } else {
            new SimpleMessageResponse("Please reply with the permission to delete.");
            return true;
        }
    }
}

module.exports = PermCommand