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

        //This list contains users waiting to enter password (to be detected via PM)
        /** @type {{userid: channelid}} */
        this._waitingForPassword = {};
        
        //This list contains authorised users that can connect to the channel (until kicked)
        //Added when password changes
        /** @type {[{user: string, channel: string}]} */
        this._authorisedUsers = [];
    }

    init() {
        this._manager._timerManager.addGlobalTimer(10 * 1000, () => this._checkChannels());
        this._dbSys = this._manager.getSystem("Database");
        this._dbSys.prepareDatabase("voice_channels");
        this._dbSys.prepareDatabase("voice_user_settings");

        this._manager.on('voiceStateUpdate', (oldMember, newMember) => this._handleConnect(oldMember, newMember));
        this._manager.on('messageOther', (message) => this._handlePassword(message));
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

    getDefaultSettings(member) {
        return {uLimit: 10, password: "", bitrate: 64, name: member.nickname == null ? member.user.username : member.nickname}
    }

    /**
     * @typedef {import('discord.js').Message} DiscordMessage
     * @param {DiscordMessage} message 
     */
    _handlePassword(message) {
        if(message.channel.type != "dm")
            return;
        let userCheck = this._waitingForPassword[message.author.id];
        if(userCheck == null)
            return;
        
        let channeldb = this._dbSys.getDatabase("voice_channels");
        let channeltable = channeldb.getData();

        let settingdb = this._dbSys.getDatabase('voice_user_settings');
        let settingstable = settingdb.getData();
        if(channeltable[userCheck.vc.id] == null)
            return;

        let channelPassword = settingstable[channeltable[userCheck.vc.id].owner].password;
        if(message.content == channelPassword) {
            userCheck.member.setVoiceChannel(userCheck.vc);
            delete this._waitingForPassword[message.author.id];
            this._authorisedUsers.push({user: userCheck.member.id, channel: userCheck.vc.id})
        } else {
            message.channel.send("Sorry that password does not seem to be correct.");
        }
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

    setChannelName(channel, name, hasPassword=false) {
        let pwPrefix = hasPassword ? this._settings.passwordChannelPrefix : "";
        channel.setName(`${this._settings.channelPrefix}${pwPrefix}${name}`)
    }

    /**
     * Creates a  new voicechannel with copied permissions, or moves an existing channel.
     * @param {GuildMember} member 
     */
    async _setupMemberChannel(member) {
        let settingdb = this._dbSys.getDatabase('voice_user_settings');
        let settingstable = settingdb.getData();
        let userSettings = settingstable[member.id];

        let channeldb = this._dbSys.getDatabase("voice_channels");
        let channeltable = channeldb.getData();
        if(userSettings == null) {
            userSettings = this.getDefaultSettings(member);
            settingstable[member.id] = userSettings;
            this._dbSys.commit(settingdb);
        }
        //If it has a password, get the prefix symbol and put after the channel prefix.
        let pwPrefix = settingstable[member.id].password.length > 0 ? this._settings.passwordChannelPrefix : "";
        let chnlName = `${this._settings.channelPrefix}${pwPrefix}${userSettings.name}`;

        //Fixed: Now checks if the user owns a channel as it exists in the db. If it is in DB but does not exist in discord, it will fail gracefully.
        let ownedChannel = member.guild.channels.find(val => channeltable[val.id] != null && channeltable[val.id].owner == member.id);
        if(ownedChannel != null) {
            if(ownedChannel.parentID != member.voiceChannel.parentID) {
                await ownedChannel.setParent(member.voiceChannel.parent);
                await ownedChannel.lockPermissions();
            }
            await member.setVoiceChannel(ownedChannel);
        } else {
            let newChannel = await member.guild.createChannel(chnlName, {
                type: "voice", 
                parent: member.voiceChannel.parent, 
                userLimit: userSettings.uLimit,
                bitrate: userSettings.bitrate * 1000, 
                //position: newChannel.parent.children.size
            });

            channeltable[newChannel.id] = {owner: member.id, expiration: Date.now() + (this._settings.defaultOwnershipHours * 60 * 60 * 1000)};
            this._dbSys.commit(channeldb);

            //Must wait for each thing, otherwise discord has a hissy fit.
            //await newChannel.lockPermissions();
            await member.setVoiceChannel(newChannel);
        }
    }

    /**
     * Checks if the channel is passworded and handles that, otherwise just lets them join.
     * @param {GuildMember} member 
     */
    async _handleCustomChannelConnection(member) {
        let channeldb = this._dbSys.getDatabase("voice_channels");
        let channeltable = channeldb.getData();

        let settingdb = this._dbSys.getDatabase('voice_user_settings');
        let settingstable = settingdb.getData();

        if(channeltable[member.voiceChannelID] == null) {
            let waitChannel = member.guild.channels.find((val) => val.type == "voice" && val.name == this._settings.disposeChannel)
            if(waitChannel == null)
                member.setVoiceChannel(null);
            else
                member.setVoiceChannel(waitChannel);
            member.user.send("There was an error connecting to that voice channel. The voice channel could not be found in the database and should not exist.");
        }
        let channelPassword = settingstable[channeltable[member.voiceChannelID].owner].password;
        if(channelPassword == "" || channelPassword == null)
            return; //Do nothing, they can connect
        
        if(channeltable[member.voiceChannelID].owner == member.id)
            return; //They are the owner, they are authorised.

        for(let i=0; i<this._authorisedUsers.length; i++) {
            let table = this._authorisedUsers[i];
            if(table.user == member.id && table.channel == member.voiceChannelID) {
                //Return, user is authorised and no further action required.
                return;
            }
        }
        
        //Handle password
        this._waitingForPassword[member.user.id] = {member: member, vc: member.voiceChannel};
        let waitChannel = member.guild.channels.find((val) => val.type == "voice" && val.name == this._settings.disposeChannel);
        if(waitChannel == null) {
            member.setVoiceChannel(null);
            member.send("There was an error: Channel needs password and could not find a waiting channel to move you to.");
        } else {
            member.setVoiceChannel(waitChannel);
        }
        member.send("You have not been authorised to join this channel and it requires a password. Please reply with correct password.");
    }

    /**
     * Handles a connection event
     * @param {GuildMember} oldMember 
     * @param {GuildMember} newMember 
     */
    async _handleConnect(oldMember, newMember) {

        //If joining the create channel, id will be different. Also make sure we aren't leaving completely.
        //None of our functions care about joining the same channel or disconnecting.
        if(oldMember.voiceChannelID == newMember.voiceChannelID || newMember.voiceChannelID == null)
            return;

        //Name of joined channel is the JOIN CREATE CHANNEL.
        if(newMember.voiceChannel.name == this._settings.creationChannel) {
            this._setupMemberChannel(newMember);
        }
        if(newMember.voiceChannel.name.startsWith(this._settings.channelPrefix)) {
            this._handleCustomChannelConnection(newMember);
        }
    }
}

module.exports = VoiceSystem;