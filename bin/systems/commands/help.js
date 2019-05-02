const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {SimpleMessageResponse, DMMessageResponse, ErrorMessageResponse, ReactMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const ErrorStrings = require("../../../errors").commands;
const {RichEmbed} = require('discord.js');

/**
 * @typedef {import('../commands')} CommandSystem
 */

class HelpCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("help");
        properties.noArgs().setFixedPermissions(true);
        properties.forceWhitelist(false);
        properties.setDetails(new CommandDetails(
            `Gives help for a specified command, or lists all`,
            `[command]`
            )
        );
        super(mgr, properties);
        /** @type {CommandSystem} */
        this._commandSys = null;
    }

    init() {
        this._commandSys = this._manager.getSystem("Commands");
    }

    /**
     * 
     * @template
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     * @returns {SimpleMessageResponse} Must return a new MessageResponse
     */
    run(message, args) {
        if(args[0] == null) {
            let rich = new RichEmbed();
            rich.setTitle("Avaliable Commands");
            for(let cmd in this._commandSys._commands) {
                let command = this._commandSys._commands[cmd];
                if(command._isAlias)
                    continue;
                if(command.checkProperties(message, null, true) != true)
                    continue;
                rich.addField(`${command.getDetails().getUsageFormatted(cmd)}`, command.getDetails()._description)
            }
            rich.setFooter("Commands are filtered by your permissions.");
            rich.setColor(0xAAAAFF);
            (new ReactMessageResponse()).generate(message);
            return new DMMessageResponse(rich);
        } else {
            if(this._commandSys._commands[args[0]] != null) {
                let cmd = this._commandSys._commands[args[0]];
                let rich = new RichEmbed();
                rich.setTitle(cmd.getDetails().getUsageFormatted(args[0]));
                rich.setDescription(cmd.getDetails()._description);
                rich.setColor(cmd.checkProperties(message, null, true) != true ? 0xFF0000 : 0x00FF00);

                return new SimpleMessageResponse(rich);
            } else {
                return new ErrorMessageResponse(ErrorStrings.unknown);
            }
        }
    }
}

module.exports = HelpCommand