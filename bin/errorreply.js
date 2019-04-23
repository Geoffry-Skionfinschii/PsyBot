const {RichEmbed} = require('discord.js');

class ErrorReply {
    static error(msg) {
        let rich = new RichEmbed();
        rich.setTitle("There was an error with your request.");
        rich.setDescription(msg);
        rich.setColor(0xFF0000);
        return rich;
    }
}

module.exports = ErrorReply