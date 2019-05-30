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

        //This list contains users waiting to enter password (to be detected via PM).
        /** @type {{userid: channelid}} */
        this._waitingForPassword = {};
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
            if(chn.type == "voice" && chn.name.startsWith(this._settings.channelPrefix)) {
                let pwRole = guild.roles.find((val) => val.name == this._settings.rolePrefix + chn.id);
                if(pwRole != null) {
                    await pwRole.delete();
                }
                await chn.delete();
            }
        });
    }

    getDefaultSettings(member) {
        return {uLimit: 10, 
            password: "", 
            bitrate: 64, 
            name: member.nickname == null ? member.user.username : member.nickname, 
            ownerTime: this._settings.defaultOwnershipHours}
    }

    addHandleSetPassword(member, channel) {
        this._waitingForPassword[member.user.id] = {member: member, vc: channel, type: "set"};
    }

    /**
     * 
     * @param {VoiceChannel} channel 
     */
    async deleteChannel(channel) {
        let db = this._dbSys.getDatabase('voice_channels');
        await channel.delete();
        delete db.getData()[channel.id]
        this._dbSys.commit(db);
    }

    /**
     * @typedef {import('discord.js').VoiceChannel} VoiceChannel
     * @param {VoiceChannel} channel 
     * @param {string} password 
     */
    async setupChannelPassword(channel, password) {
        let channeldb = this._dbSys.getDatabase("voice_channels");
        let channeltable = channeldb.getData();

        if(password.length == 0) {
            await channel.overwritePermissions(channel.guild.defaultRole, {
                CONNECT: true
            })
        } else {
            await channel.overwritePermissions(channel.guild.defaultRole, {
                CONNECT: false
            });
            //Get owner and give him the new role :D
            let ownerID = channeltable[channel.id].owner;
            let owner = channel.guild.member(ownerID);
            if(owner != null) {
                channel.overwritePermissions(owner, {
                    CONNECT: true
                });
            }
        }
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

        if(userCheck.type == "join") {

            let channelPassword = settingstable[channeltable[userCheck.vc.id].owner].password;
            if(message.content == channelPassword) {
                if(userCheck.member.voiceChannel != null)
                    userCheck.member.setVoiceChannel(userCheck.vc);
                delete this._waitingForPassword[message.author.id];
                    userCheck.vc.overwritePermissions(usercheck.member, {CONNECT: true}, "Authorised to join channel");
                message.channel.send("You have been authorised to join " + userCheck.vc.name);
            } else {
                message.channel.send("Sorry that password does not seem to be correct.");
            }
        } else if (userCheck.type == "set") {
            let newPw = message.content == "?" ? "" : message.content;
            delete this._waitingForPassword[message.author.id];
            settingstable[userCheck.member.id].password = newPw;
            if(userCheck.vc != null) {
                this.setChannelName(userCheck.vc, settingstable[userCheck.member.id].name, newPw.length > 0);
                this.setupChannelPassword(userCheck.vc, newPw);
            }
            this._dbSys.commit(settingdb);
            message.channel.send("Successfully set the password to `" + newPw + "` (This message will be deleted shortly)").then((msg) => {
                setTimeout(() => msg.delete(), 5000);
            });
        }
    }

    //Go through database and find out whats goin on.
    /**
     * Repeatedly scans the database and manages the channels
     * @todo
     */
    _checkChannels() {
        let guild = this._manager._discordClient.guilds.get("359250752813924353");
        guild.channels.forEach(async (chn) => {
            if(chn.type == "voice" && chn.name.startsWith(this._settings.channelPrefix)) {
                let db = this._dbSys.getDatabase('voice_channels')
                let dat = db.getData()[chn.id];
                if(chn.members.size == 0 && (dat == null || Date.now() > dat.expiration)) {
                    this.deleteChannel(chn);
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
                await this.setupChannelPassword(ownedChannel, settingstable[member.id].password);
            }
            await member.setVoiceChannel(ownedChannel);
        } else {
            let newChannel = await member.guild.createChannel(chnlName, {
                type: "voice", 
                parent: member.voiceChannel.parent, 
                userLimit: userSettings.uLimit,
                bitrate: userSettings.bitrate * 1000, 
            });

            channeltable[newChannel.id] = {owner: member.id, expiration: Date.now() + (userSettings.ownerTime * 60 * 60 * 1000)};
            this._dbSys.commit(channeldb);

            await this.setupChannelPassword(newChannel, settingstable[member.id].password);

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