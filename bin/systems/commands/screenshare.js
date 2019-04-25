const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {SimpleMessageResponse, ErrorMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const ErrorStrings = require('../../../errors').commands;
const {RichEmbed} = require('discord.js');

class ShareCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("screenshare");
        properties.noArgs().setFixedPermissions(false);
        properties.forceWhitelist(true);
        properties.setDetails(new CommandDetails("Puts a link to make the voice channel a screen-share channel", ``));
        super(mgr, properties);
    }

    init() {
    }

    /**
     * @typedef {import('discord.js').Message} DiscordMessage
     * @param {DiscordMessage} message 
     * @param {*} args 
     */
    run(message, args) {
        if(message.member.voiceChannel == null) {
            return new ErrorMessageResponse(ErrorStrings.notInVC);
        } else {
            let rich = new RichEmbed();
            rich.setTitle(`https://discordapp.com/channels/${message.guild.id}/${message.member.voiceChannel.id}`);
            return new SimpleMessageResponse(rich);
        }
    }
}

module.exports = ShareCommand