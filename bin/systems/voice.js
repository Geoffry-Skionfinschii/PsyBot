const DefaultSystem = require('../system');
const fs = require('fs');
const Config = require('../../config')
const Utils = require('../util');

/**
 * @typedef {import('discord.js').GuildMember} GuildMember
 * @typedef {import('discord.js').Guild} Guild
 * @typedef {import('../systems/database')} Database
 */


class VoiceSystem extends DefaultSystem {
    constructor(client) {
        super(client, "Voice");

        this._settings = {
            creationChannel: "[Join to Create]",
            disposeChannel: "Waiting...",
            channelPrefix: "$"
        }
        /** @type {Database} */
        this._dbSys = null;
    }

    init() {
        this._manager._timerManager.addGlobalTimer(10 * 1000, () => this._checkChannels());
        this._dbSys = this._manager.getSystem("Database");
        this._dbSys.prepareDatabase("voice_channels");

        this._manager.on('voiceStateUpdate', (oldMember, newMember) => this._handleConnect(oldMember, newMember));
    }

    postinit() {
    }

    /**
     * Cycles through and deletes all channels starting with the prefix
     * @param {Guild} guild 
     */
    destroyAllChannels(guild) {
        guild.channels.forEach(async (chn) => {
            if(chn.type == "voice" && chn.name.startsWith(this._settings.channelPrefix))
                await chn.delete();
        });
    }


    //Go through database and find out whats goin on.
    /**
     * Repeatedly scans the database and manages the channels
     * @todo
     */
    _checkChannels() {
        let guild = this._manager._discordClient.guilds.get("359250752813924353");
        guild.channels.forEach((chn) => {
            if(chn.type == "voice" && chn.name.startsWith(this._settings.channelPrefix)) {
                if(chn.members.size == 0)
                    chn.delete();
            }
        });
    }

    /**
     * Handles a connection event
     * @param {GuildMember} oldMember 
     * @param {GuildMember} newMember 
     */
    async _handleConnect(oldMember, newMember) {
        //Only i can trigger atm
        //If joining the create channel, id will be different. Also make sure we aren't leaving completely.
        if(oldMember.voiceChannelID == newMember.voiceChannelID || newMember.voiceChannelID == null)
            return;

        //Name must match name defined in settings. Now we create the channel :D
        if(newMember.voiceChannel.name == this._settings.creationChannel) {
            let chnlName = `${this._settings.channelPrefix}${newMember.nickname == null ? newMember.user.username : newMember.nickname}`;
            let newChannel = await newMember.guild.createChannel(chnlName, "voice");
            //Must wait for each thing, otherwise discord has a hissy fit.
            await newChannel.setUserLimit(10);
            await newChannel.setParent(newMember.voiceChannel.parent);
            await newChannel.setPosition(newChannel.parent.children.size, true);
            await newMember.setVoiceChannel(newChannel);
            
        }
    }
}

module.exports = VoiceSystem;