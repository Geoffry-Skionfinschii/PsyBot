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
        let properties = new CommandProperty("editvc");
        properties.setArgs(1, 2).setFixedPermissions(false);
        properties.forceWhitelist(true);
        properties.setDetails(new CommandDetails(
            "Allows you to edit your JTC channel. Empty VALUE will revert to default." +
            "\nValid Properties are: `name, users, password, bitrate` and also `delete`" +
            "\n`name`: Max length of 20 chars, will change your channel name. Set to '' to reset" +
            "\n`users`: Changes max users allowed to connect (0 to 99)" +
            "\n`password`: Sets channel password to connect. Max length of 40. If you do not specify the value, the bot will PM you and ask you to send it the password." +
            "\n`bitrate`: Sets channel bitrate (number between 8 and 96)", //TODO 
            "<property> [value]"));
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
        let num = null;
        //{uLimit: 10, password: "", bitrate: 64, name: member.nickname == null ? member.user.username : member.nickname}
        switch(args[0]) {
            case "users":
                num = parseInt(args[1]);
                if(isNaN(num) || num < 0 || num > 99)
                    num = 10;
                if(!uCNull)
                    userChannel.setUserLimit(num);
                userSettings.uLimit = num;
            break;
            case "password":
                this._voiceSys.addHandleSetPassword(message.member, userChannel);
                return new DMMessageResponse("You are setting the password for your channel. Reply with new password" + 
                "\nPlease note passwords ARE stored plaintext. Please use new passwords and don't make them anything important.\n\nReply with ? to remove password.");
            break;
            case "bitrate":
                num = parseInt(args[1]);
                if(isNaN(num) || num < 8 || num > 96)
                    num = 64;
                if(!uCNull)
                    userChannel.setBitrate(num);
                userSettings.bitrate = num;
            break;
            case "name":
                if(args[1].length > 20)
                    return new ErrorMessageResponse("Property `name` must be less than 15 chars.")
                let newName = args[1]
                if(args[1].length == 0) 
                    newName = message.member.nickname == null ? message.member.user.username : message.member.nickname;
                if(!uCNull)
                    this._voiceSys.setChannelName(userChannel, newName, userSettings.password.length > 0);
                userSettings.name = newName;
            break;
            case "delete":
                if(!uCNull) {
                    this._voiceSys.deleteChannel(userChannel);
                }
            break;
            default:
                return new ErrorMessageResponse("Unknown Property. Properties are `name`, `bitrate`, `users`, `password` or `delete`");
            break;
        }

        settingsTable[message.member.id] = userSettings;
        this._dbSys.commit(settingsDB);
        return new ReactMessageResponse();
    }
}

module.exports = PingCommand