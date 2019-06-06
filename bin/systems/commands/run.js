const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {ReactMessageResponse, SimpleMessageResponse, ErrorMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");
const Errors = require('../../../errors');
const ScriptUtils = require("../../scriptutils");
const {RichEmbed} = require('discord.js');

class RunCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("run");
        properties.setArgs(0, 1).setFixedPermissions(false);
        properties.forceWhitelist(true);
        properties.allowDM(true);
        properties.setDetails(new CommandDetails("Executes specified script. `.sh` is optional", "[script]"));
        super(mgr, properties);
    }

    init() {
    }
    
    handleBadScript() {
        let files = ScriptUtils.getScripts();
        let output = '';
        for(let i=0; i<files.length; i++) {
            output += `\n${files[i]}`;
        }
        let rich = new RichEmbed();
        rich.setTitle("Avaliable Scripts");
        rich.setDescription(output);
        return new SimpleMessageResponse(rich);
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
        if(args[0] == null) {
            return this.handleBadScript();
        }
        let success = ScriptUtils.runScript(args[0].replace('.sh', ''), args[0]);
        if(success == null) {
            return this.handleBadScript();
        }
        if(success == false) {
            return new ErrorMessageResponse(Errors.scripts.windowExists);
        }
        return new ReactMessageResponse();
    }
}

module.exports = RunCommand