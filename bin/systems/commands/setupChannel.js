const {DefaultCommand,CommandProperty, CommandDetails} = require('../../templates/command');
const {ReactMessageResponse, ErrorMessageResponse} = require('../../messageresponse');
const Config = require("../../../config");

class ChannelCommand extends DefaultCommand {
    constructor(mgr) {
        let properties = new CommandProperty("setupgame");
        properties.noArgs().setFixedPermissions(true);
        properties.addWhitelist("user", Config.owner);
        properties.addWhitelist("role", "534221293541916672", true);
        properties.forceWhitelist(true);
        properties.setArgs(2, -1);
        properties.setDetails(new CommandDetails(
            `Creates a new category and channels based on preferences.

            If the second argument is true/false you will have to specify each channel name manually
            in the format "name|type" where type can be 'text' or 'voice'
            
            If the second argument is 'default' you will have to give a shortname which will be used
            to create a #<shortname>-general and #<shortname>-lfg channel along with the JTC channel.`, 
        "<name> <JTCVC:true/false> [channel1name|type] [channel2name|type] [channel3name|type]...\n<name> <'default'> <shortname>"));
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
        /** @type {ChannelSetupType[]} */
        let channelList = [];
        if(args[1] == 'default') {
            if(args[2] == null) {
                return new ErrorMessageResponse("The shortname was not given!");
            }
            
            channelList.push(new ChannelSetupType(`${args[2]}-general`, 'text'));
            channelList.push(new ChannelSetupType(`${args[2]}-lfg`, 'text'));
            this._generateChannels(channelList, args[0], message.guild, true);
        } else {
            let argBool = args[1].toLowerCase() == "true";
            

            let userSpec = args;
            userSpec.slice(2);
            for(let i=0; i<args.length; i++) {
                let arr = args[i].split("|");
                if(arr.length != 2) continue;
                channelList.push(new ChannelSetupType(arr[0], arr[1]));
            }

            this._generateChannels(channelList, args[0], message.guild, argBool);
        }
        return new ReactMessageResponse();
    }

    /**
     * @typedef {import('discord.js').Guild} DiscordGuild
     * @param {ChannelSetupType[]} channels 
     * @param {string} name 
     * @param {DiscordGuild} guild
     * @param {boolean} JTC
     */
    async _generateChannels(channels, name, guild, JTC) {
        let newRole = await guild.createRole({name: Config.voiceSystem.rolePrefix + name, mentionable: false}, "Setup of new channels");
        let category = await guild.createChannel(name, {type: 'category'})
        category.overwritePermissions(guild.defaultRole, {
            VIEW_CHANNEL: false,
        })
        category.overwritePermissions(newRole, {
            VIEW_CHANNEL: true
        })

        for(let i=0; i<channels.length; i++) {
            channels[i].create(category, guild);
        }

        if(JTC) {
            let JtcChannel = await guild.createChannel(Config.voiceSystem.creationChannel, {type: 'voice', parent: category});
            JtcChannel.overwritePermissions(guild.defaultRole, {SPEAK: false});
        }
    }
}

class ChannelSetupType {
    /**
     * 
     * @param {string} name 
     * @param {'text' | 'voice'} type 
     */
    constructor(name, type) {
        this._name = name;
        this._type = type;
        if (!(type == 'text' || type == 'voice')) {
            this._type = 'text';
        }
    }

    /**
     * @typedef {import('discord.js').CategoryChannel} DiscordCategoryChannel
     * @typedef {import('discord.js').Message} DiscordMessage
     * @typedef {import('discord.js').Role} Role
     * @param {DiscordCategoryChannel} category 
     * @param {DiscordGuild} guild
     * @param {Role} role
     */
    async create(category, guild, role) {
        let channel = await guild.createChannel(this._name, {type: this._type, parent: category});
    }
}

module.exports = ChannelCommand