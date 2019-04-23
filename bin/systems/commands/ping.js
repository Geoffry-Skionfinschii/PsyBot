const {DefaultCommand,DefaultAlias,CommandProperty} = require('../../templates/command');

class PingCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("ping");
        properties.allowDM(true).noArgs().setFixedPermissions(false);
        super(mgr, properties);
    }

    run(message, args) {
        return "Pong";
    }
}

module.exports = PingCommand