const DefaultSystem = require('../system');
const fs = require('fs');
const Config = require('../../config')
const Utils = require('../util');
const {RichEmbed} = require('discord.js');

/**
 * @typedef {import('discord.js').GuildMember} GuildMember
 * @typedef {import('discord.js').Message} DiscordMessage
 * @typedef {import('discord.js').TextChannel} TextChannel
 * @typedef {import('../systems/database')} Database
 */


class KillboardSystem extends DefaultSystem {
    constructor(client) {
        super(client, "ArmaKillboard");
        this._armaChannel = null;
        this._armaMessages = {};

        this._dbSys = null;
    }

    init() {
        this._manager.on('messageOther', (msg) => this._handleMessage(msg));
        this._manager.on('ready', () => this._handleReady());
        /** @type {Database} */
        this._dbSys = this._manager.getSystem("Database");
        this._dbSys.prepareDatabase("killboard_data");

        /*
        DB structure
        data : {
            id: {
                name: string
                kills: [
                    {name, distance}
                ]
            }
        }
        */
    }

    postinit() {
    }

    _updateMessages() {
        let killtable = this._dbSys.getDatabase("killboard_data");
        let dat = killtable.getData();
        for(let id in dat) {
            this._updateMessage(id, dat.id);
        }
    }

    async _updateMessage(id, dat) {
        if(this._armaMessages[id] != null) {
            this._armaMessages[id].edit(this._createEmbed(id, dat));
        } else {
            let msg = await this._armaChannel.send(this._createEmbed(id, dat));
            this._armaMessages[id] = msg;
        }
    }

    /**
     * Handles a connection event
     * @param {DiscordMessage} message 
     */
    async _handleMessage(message) {
        if(message.channel.id != Config.armaKillboardChannel) 
            return;

        if(message.content == "update") {
            let killtable = this._dbSys.getDatabase("killboard_data");
            let dat = killtable.getData();
            if(dat[message.member.id] == null)
                dat[message.member.id] = {name: message.author.username, kills: []};
            this._updateMessage(message.member.id, dat[message.member.id]);
            await message.delete();
            return;
        }

        try {
            let dist = message.content.match(/([0-9]*($|m$))/)[0].replace("m", "").trim(); //Get the number with or without meters.
            let name = message.content.replace(/([0-9]*($|m$))/, "").trim() //Replace the number with or without meters to get name.
            let killtable = this._dbSys.getDatabase("killboard_data");
            let dat = killtable.getData();
            if(dat[message.member.id] == null)
                dat[message.member.id] = {name: message.author.username, kills: []};
            if(name.length > 0) {
                dat[message.member.id].kills.push({name: name, distance: parseInt(dist)});
            } else {
                dat[message.member.id].kills.push({distance: parseInt(dist)});
            }
            this._dbSys.commit(killtable);
            this._updateMessage(message.member.id, dat[message.member.id]);
        } catch (e) {
            message.author.send("Could not add kill - `" + e + "`");
        }
        await message.delete();
    }

    /**
     * Sets up when discord client is ready for data.
     */
    async _handleReady() {
        let guild = Utils.getGuild(this._manager._discordClient);
        /** @type {TextChannel} */
        let channel = guild.channels.find((chn) => chn.id == Config.armaKillboardChannel);
        if(channel == null)
            return;
        this._armaChannel = channel;
        
        let messages = await channel.fetchMessages();
        messages.forEach((message) => {
            if(message.author.id == this._manager._discordClient.user.id) {
                if(message.embeds.length > 0) {
                    this._armaMessages[message.embeds[0].footer.text] = message;
                    Utils.log("KillBoard", "Found arma board for user " + message.embeds[0].footer.text);
                }
            }
        });
    }

    /**
     * Creates a rich embed for a players kills from database
     * @param {Object} data 
     */
    _createEmbed(id, data) {
        let rich = new RichEmbed();
        let longest = 0;
        let killStr = "";
        let iter = 0;
        data.kills.forEach((val) => {
            iter++;
            if(val.distance > longest)
                longest = val.distance;
            
            killStr += `${iter}. ${val.name != null ? val.name : "Random"} < ${val.distance}m >\n`;
        })
        rich.setTitle(`${data.name} Kills - ${longest}`);
        rich.setDescription(`\`\`\`md\n${killStr}\`\`\``);
        rich.setFooter(id);
        return rich;
    }
}

module.exports = KillboardSystem;