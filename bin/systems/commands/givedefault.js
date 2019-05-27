const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {ReactMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");

class RoleDefaultCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("givedefault");
        properties.noArgs().setFixedPermissions(true);
        properties.forceWhitelist(true);
        properties.addWhitelist("user", Config.owner);
        properties.setDetails(new CommandDetails("Literally gives everyone the default role.", ""));
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
        this._giveEveryoneRole(message.guild)
        return new ReactMessageResponse();
    }

    /**
     * @typedef {import('discord.js').Guild} Guild
     * @param {Guild} guild 
     */
    async _giveEveryoneRole(guild) {
        guild.members.forEach(async (val) => {
            await val.addRole(guild.roles.find((role) => role.name == "default"));
        });
    }
}

module.exports = RoleDefaultCommand