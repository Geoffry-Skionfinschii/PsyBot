const {DefaultCommand,DefaultAlias,CommandProperty} = require('../../templates/command');
const {SimpleMessageResponse} = require('../../messageresponse');

class PingCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("ping");
        properties.allowDM(true).noArgs().setFixedPermissions(false);
        super(mgr, properties);
    }

    init() {
        let cmdSys = this._manager.getSystem("Commands");
        cmdSys.registerAlias(new DefaultAlias("poing", this));
    }

    run(message, args) {
        return new SimpleMessageResponse("Pong");
    }
}

module.exports = PingCommand