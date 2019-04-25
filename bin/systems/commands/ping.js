const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {SimpleMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");

class PingCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("ping");
        properties.noArgs().setFixedPermissions(false);
        properties.forceWhitelist(true);
        properties.setDetails(new CommandDetails("Pings and Pongs", ""));
        super(mgr, properties);
    }

    init() {
    }

    run(message, args) {
        return new SimpleMessageResponse("Pong");
    }
}

module.exports = PingCommand