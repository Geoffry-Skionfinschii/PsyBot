const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {ReactMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");

class PingCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("ping");
        properties.noArgs().setFixedPermissions(false);
        properties.forceWhitelist(false);
        properties.setDetails(new CommandDetails("You ping, it does a reaction.", ""));
        super(mgr, properties);
    }

    init() {
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
        return new ReactMessageResponse(":psycooperative:568319073650475020");
    }
}

module.exports = PingCommand