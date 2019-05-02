const {DefaultCommand,CommandProperty,DefaultAlias} = require('../../templates/command');
const {SimpleMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const {RichEmbed} = require("discord.js");

/**
 * @typedef {import('../commands')} CommandSystem
 */

class TowerCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("911");
        properties.allowDM(true).noArgs().setFixedPermissions(false);
        properties.forceWhitelist(true);
        super(mgr, properties);
    }
    init() {
        /** @type {CommandSystem} */
        let cmdSys = this._manager.getSystem("Commands");
        cmdSys.registerAlias(new DefaultAlias("9/11", this))	
		
    }

    /**
     * 
     * @template
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     * @returns {SimpleMessageResponse} Must return a new MessageResponse
     */
    run(message, args) {
        let rich = new RichEmbed();
        rich.setTitle("Bush did it");
        rich.setImage("https://i.ytimg.com/vi/3_MMYI9POc0/maxresdefault.jpg");
        rich.setFooter("I didn't make this, Pyseirn did.");
        return new SimpleMessageResponse(rich);
    }
}

module.exports = TowerCommand;