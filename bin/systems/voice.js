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

        this._settings = Config.voiceSystem;
           
        /** @type {Database} */
        this._dbSys = null;
    }

    init() {
        this._manager._timerManager.addGlobalTimer(10 * 1000, () => this._checkChannels());
        this._dbSys = this._manager.getSystem("Database");
        this._dbSys.prepareDatabase("voice_channels");
        this._dbSys.prepareDatabase("voice_user_settings");

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
                let db = this._dbSys.getDatabase('voice_channels')
                let dat = db.getData()[chn.id];
                if(chn.members.size == 0 && (dat == null || Date.now() > dat.expiration)) {
                    chn.delete();
                    delete db.getData()[chn.id]
                    this._dbSys.commit(db);
                }
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
            let settingdb = this._dbSys.getDatabase('voice_user_settings');
            let settingstable = settingdb.getData();
            let userSettings = settingstable[newMember.id];
            if(userSettings == null) {
                userSettings = {uLimit: 10, password: "", bitrate: 64, name: newMember.nickname == null ? newMember.user.username : newMember.nickname}
                settingstable[newMember.id] = userSettings;
                this._dbSys.commit(settingdb);
            }
            let chnlName = `${this._settings.channelPrefix}${userSettings.name}`;

            let ownedChannel = newMember.guild.channels.find(val => val.name == chnlName);
            if(ownedChannel != null) {
                if(ownedChannel.parentID != newMember.voiceChannel.parentID) {
                    await ownedChannel.setParent(newMember.voiceChannel.parent);
                    await ownedChannel.lockPermissions();
                }
                newMember.setVoiceChannel(ownedChannel);
                return;
            }

            let newChannel = await newMember.guild.createChannel(chnlName, {
                type: "voice", 
                parent: newMember.voiceChannel.parent, 
                userLimit: userSettings.uLimit,
                bitrate: userSettings.bitrate * 1000, 
                //position: newChannel.parent.children.size
            });

            let db = this._dbSys.getDatabase('voice_channels');
            let table = db.getData();
            table[newChannel.id] = {owner: newMember.id, expiration: Date.now() + (this._settings.defaultOwnershipHours * 60 * 60 * 1000)};
            this._dbSys.commit(db);

            //Must wait for each thing, otherwise discord has a hissy fit.
            //await newChannel.lockPermissions();
            await newMember.setVoiceChannel(newChannel);
            
        }
    }
}

module.exports = VoiceSystem;