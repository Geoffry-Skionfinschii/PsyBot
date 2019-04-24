const Config = require("../config")
const {RichEmbed} = require("discord.js");

/**
 * @typedef {import('discord.js').Message} DiscordMessage
 */

class SimpleMessageResponse {
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
    constructor() {
        super("");
    }

    generate(message) {
    }
}

class DMMessageResponse extends SimpleMessageResponse {
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