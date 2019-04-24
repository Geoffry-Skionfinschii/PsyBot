const {DefaultCommand,CommandProperty,DefaultAlias} = require('../../templates/command');
const {SimpleMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const {RichEmbed} = require("discord.js");

class 911Command extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("911");
        properties.allowDM(true).noArgs().setFixedPermissions(true);
        properties.forceWhitelist(false);
        super(mgr, properties);
    }

    init() {
		let cmdSys = this._manager.getSystem("Commands");
		cmdSys.registerAlias(new DefaultAlias("name", this))	
		
    }

    run(message, args) {
		let rich = new RichEmbed();
		rich.setTitle("Bush did it");
		rich.setImage("url");
		return new SimpleMessageResponse(rich);
    }
}

module.exports = 911Command