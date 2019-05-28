const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {SimpleMessageResponse, ErrorMessageResponse, ReactMessageResponse, DMMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");

/**
 * @typedef {import('../database')} Database
 * @typedef {import('../voice')} Voice
 * @typedef {import('discord.js').Message} DiscordMessage
 */

class PingCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("setvctime");
        properties.setArgs(-1, 1).setFixedPermissions(false);
        properties.forceWhitelist(true);
        properties.setDetails(new CommandDetails(
            "Sets how long the channel will exist before deletion. Will also refresh the time to now.", "[timeInHours]"));
        super(mgr, properties);

        /** @type {Database} */
        this._dbSys = null;

        /** @type {Voice} */
        this._voiceSys = null;
    }

    init() {
        this._dbSys = this._manager.getSystem("Database");
        this._voiceSys = this._manager.getSystem("Voice");
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
        let settingsDB = this._dbSys.getDatabase("voice_user_settings");
        let settingsTable = settingsDB.getData();

        let channelDB = this._dbSys.getDatabase("voice_channels");
        let channelTable = channelDB.getData();

        let userSettings = settingsTable[message.member.id];
        if(userSettings == null) {
            userSettings = this._voiceSys.getDefaultSettings(message.member);   
        }
        let userChannel = message.guild.channels.find((val) => val.type == 'voice' && channelTable[val.id] != null && channelTable[val.id].owner == message.member.id);
        let uCNull = userChannel == null;
        let num = parseFloat(args[0]);
        if(!isNaN(num)) {
            userSettings.ownerTime = num;
        }
        if(!uCNull)
            channelTable[userChannel.id].expiration = Date.now() + (userSettings.ownerTime * 60 * 60 * 1000);
        

        settingsTable[message.member.id] = userSettings;
        this._dbSys.commit(settingsDB);
        return new ReactMessageResponse();
    }
}

module.exports = PingCommand