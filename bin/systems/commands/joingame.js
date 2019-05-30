const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {ReactMessageResponse, SimpleMessageResponse, NoneMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const Utils = require('../../util');
const {RichEmbed} = require('discord.js');

/**
 * @typedef {import('discord.js').Message} DiscordMessage
 */

class JoinCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("joingame");
        properties.noArgs().setFixedPermissions(false);
        properties.setArgs(-1,1);
        properties.forceWhitelist(false);
        properties.setDetails(new CommandDetails("This will give you the role to access the games channels!\nRemember to put the game name in '' if it has spaces in it\n\n* will join all valid roles.", "<game>\n'*'"));
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
        if(args[0] == null || args[0] == "") {
            this.listGames(message);
        } else if (args[0] == "*") {
            let roles = message.guild.roles.array();
            for(let i=0; i<roles.length; i++) {
                let role = roles[i];
                if(role.name.startsWith(Config.gameSystem.rolePrefix)) {
                    message.member.addRole(role);
                }
            }
            return new SimpleMessageResponse(new RichEmbed().setTitle("Signed you up for all games!"));
        } else {
            let roles = message.guild.roles;
            let roleMention = Utils.stripHeaderFromType(args[0]);
            let role = roles.find((val) => val.id == roleMention || val.name == roleMention || val.name.substring(2) == roleMention);
            if(role != null && role.name.startsWith(Config.gameSystem.rolePrefix)) {
                message.member.addRole(role);
                return new SimpleMessageResponse(new RichEmbed().setTitle("Signed you up for " + role.name));
            } else {
                this.listGames(message);
            }
        }
        return new NoneMessageResponse();
    }

    /**
     * 
     * @param {DiscordMessage} message 
     */
    listGames(message) {
        let roles = message.guild.roles.array();
        let rich = new RichEmbed();
        rich.setTitle("Valid Game Channels");
        let str = "";
        for(let i=0; i<roles.length; i++) {
            let role = roles[i];
            if(role.name.startsWith(Config.gameSystem.rolePrefix)) {
                str += `${i > 0 ? '\n' : ''}- '${role.name.substring(2)}'`;
            } else continue;
        }
        rich.setDescription('`' + str + '`');
        new SimpleMessageResponse(rich).generate(message);
    }
}

module.exports = JoinCommand