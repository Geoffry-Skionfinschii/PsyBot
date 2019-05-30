const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {ReactMessageResponse, ErrorMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const Utils = require('../../util');
const ErrorTargets = require("../../../errors").commands.targets

/**
 * @typedef {import('discord.js').CategoryChannel} DiscordCategoryChannel
 * @typedef {import('discord.js').Message} DiscordMessage
 */

class DelChannelCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("deletegame");
        properties.noArgs().setFixedPermissions(true);
        properties.addWhitelist("user", Config.owner);
        properties.addWhitelist("role", "534221293541916672", true);
        properties.forceWhitelist(true);
        properties.setArgs(1, 2);
        properties.setDetails(new CommandDetails(
            `Deletes category and role references to a game.
            If the command throws an error that it cannot find the category *reliably*, you will have to pass category ID.`, 
        "<roleMention/roleID> [categoryID]"));
        super(mgr, properties);
    }

    init() {
    }
    
    //Return a new MessageResponse.
    /**
     * 
     * @template
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     * @returns {SimpleMessageResponse} Must return a new MessageResponse
     */
    run(message, args) {
        let roleID = Utils.stripHeaderFromType(args[0]);
        let role = message.guild.roles.get(roleID);
        if(role == null) {
            return new ErrorMessageResponse(ErrorTargets.unknownRole);
        }
        if(!role.name.startsWith(Config.gameSystem.rolePrefix)) {
            return new ErrorMessageResponse("This role is not a game-based role!");
        }
        /** @type {DiscordCategoryChannel} */
        let channel = null;
        if(args[1] == null) {
            // Find channel id from role name.
            let roleName = role.name.substring(2);
            channel = message.guild.channels.find('name', roleName);
            if(channel == null || channel.type != 'category') {
                return new ErrorMessageResponse("Could not find the category based on role name.");
            }
        } else {
            channel = message.guild.channels.get(Utils.stripHeaderFromType(args[1]));
            if(channel == null || channel.type != 'category') {
                return new ErrorMessageResponse(ErrorTargets.unknownCategory);
            }
        }
        let children = channel.children.array();
        this._deleteChannels(children, channel, role);
        return new ReactMessageResponse();

    }

    async _deleteChannels(children, channel, role) {
        for(let i=0; i<children.length; i++) {
            await children[i].delete();
        }
        await channel.delete();
        await role.delete();
    }
}

module.exports = DelChannelCommand