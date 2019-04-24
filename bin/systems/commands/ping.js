const {DefaultCommand,CommandProperty} = require('../../templates/command');
const {SimpleMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");

class PingCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("ping");
        properties.allowDM(true).noArgs().setFixedPermissions(true);
        properties.forceWhitelist(true);
        properties.addWhitelist("user", Config.owner);
        properties.addBlacklist("channel", "568294324165672971");
        super(mgr, properties);
    }

    init() {
        let cmdSys = this._manager.getSystem("Commands");
    }

    run(message, args) {
        return new SimpleMessageResponse("Pong");
    }
}

module.exports = PingCommand