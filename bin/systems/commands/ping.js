const {DefaultCommand,CommandProperty} = require('../../templates/command');
const {SimpleMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");

class PingCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("ping");
        properties.allowDM(true).noArgs().setFixedPermissions(true);
        properties.forceWhitelist(false);
        super(mgr, properties);
    }

    init() {
    }

    run(message, args) {
        return new SimpleMessageResponse("Pong");
    }
}

module.exports = PingCommand