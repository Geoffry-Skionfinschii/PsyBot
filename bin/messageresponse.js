const Config = require("../config")
const {RichEmbed} = require("discord.js");

/**
 * @typedef {import('discord.js').Message} DiscordMessage
 * @typedef {import('discord.js').ReactionEmoji} ReactionEmoji
 * @typedef {import('discord.js').Emoji} Emoji
 */

class SimpleMessageResponse {
    /**
     * SimpleMessage sends whatever is in data to the channel
     * @param {string | number} data 
     */
    constructor(data) {
        this._data = data;
    }

    /**
     * 
     * @param {DiscordMessage} message 
     */
    generate(message) {
        message.channel.send(this._data)
    }
}

class ReactMessageResponse extends SimpleMessageResponse {
    /**
     * Reacts to the given message
     * @param {ReactionEmoji | Emoji | string} data 
     */
    constructor(data) {
        super(data);
    }

    /**
     * 
     * @param {DiscordMessage} message 
     */
    generate(message) {
        if(this._data == null) {
            message.react(Config.defaultReact);
        } else {
            message.react(this._data);
        }
    }
}

class NoneMessageResponse extends SimpleMessageResponse {
    /**
     * Does not do anything on generate
     */
    constructor() {
        super("");
    }

    generate(message) {
    }
}

class DMMessageResponse extends SimpleMessageResponse {
    /**
     * Sends the content directly to the users dm
     * @param {string | number} data 
     */
    constructor(data) {
        super(data)
    }

    /**
     * 
     * @param {DiscordMessage} message 
     */
    generate(message) {
        message.author.send(this._data)
    }
}

class ErrorMessageResponse extends SimpleMessageResponse {
    /**
     * The text supplied will be put in a rich embed in error format
     * @param {string | number} data 
     */
    constructor(data) {
        super(data)
    }

    /**
     * 
     * @param {DiscordMessage} message 
     */
    generate(message) {
        let rich = new RichEmbed();
        rich.setTitle(this._data);
        rich.setColor(0xFF0000);
        message.channel.send(rich)
    }
}

module.exports = {SimpleMessageResponse, ReactMessageResponse, NoneMessageResponse, DMMessageResponse, ErrorMessageResponse}