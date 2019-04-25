const Config = require("../../config");
const ErrorStrings = require("../../errors").commands;
const Utils = require("../util");
const {ErrorMessageResponse, NoneMessageResponse} = require('../messageresponse');

//JSDocs
/**
 * @typedef {import('discord.js').Message} DiscordMessage
 * @typedef {import('../manager')} Manager
 */

class DefaultCommand {
    /**
     * 
     * @param {Manager} mgr 
     * @param {CommandProperty} properties 
     * @param {string} name 
     */
    constructor(mgr, properties) {
        this._manager = mgr;
        this._isAlias = false;
        this._aliases = [];
        this._name = properties._command;

        this._properties = properties;
    }

    preinit() {
        if(!this._properties._fixedPermissions)
            this._properties._updatePermissions(this._manager);
    }

    init() {

    }

    //DO NOT OVERRIDE
    /**
     * 
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     */
    exec(message, args) {
        let resp = this.checkProperties(message, args);
        if(resp == true) {
            return this.run(message, args);
        } else if(resp != false) {
            return new ErrorMessageResponse(resp);
        }
        return new NoneMessageResponse();
    }

    //User defined.
    //Return a new MessageResponse.
    /**
     * 
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     */
    run(message, args) {
        return [false, ErrorStrings.notImplemented];
    }

    getDetails() {
        return this._properties._details;
    }

    //Can be overridden, must return string error or true. False will fail without error.
    /**
     * 
     * @param {DiscordMessage} message 
     */
    checkProperties(message, args, ignoreArgs=false) {
        //Channel type
        if(/*!props._allowDM && */message.channel.type == "dm")
            return ErrorStrings.dmUnsupported/*ErrorStrings.dmDisabled*/;

        let props = this._properties;
        //Blacklist. Blacklist only has channels and users
        let channelID = message.channel.id;
        let highRole = message.member.highestRole;
        let roles = message.member.roles;
        let userID = message.member.id;
        let isBlacklisted = null;
        for(let item in props._blacklist) {
            let entry = props._blacklist[item];
            switch(entry.type) {
                case "user":
                    if(userID == entry.id) {
                        isBlacklisted = ErrorStrings.blacklistedUser;
                        break;
                    }
                break;
                case "channel":
                    if(channelID == entry.id) {
                        isBlacklisted = false;
                        break;
                    }
                break;
            }
        }
        if(isBlacklisted != null) 
            return isBlacklisted;

        //Whitelist. Whitelist only has roles and users
        let isWhitelisted = null;
        if(props._useWhitelist) {
            for (let item in props._whitelist) {
                //Can't break out of switch, if we are whitelisted, leave
                if(isWhitelisted)
                    break;

                let entry = props._whitelist[item];
                switch(entry.type) {
                    case "user":
                        if(entry.id == userID) {
                            isWhitelisted = true;
                        }
                    break;
                    case "role":
                        //Check if it is exact or ranked match
                        if(entry.exact) {
                            if(roles.get(entry.id) != null) {
                                isWhitelisted = true;
                            }
                        } else {
                            let lowRole = message.guild.roles.get(entry.id);
                            if (!(lowRole == null || lowRole.calculatedPosition > highRole.calculatedPosition)) {
                                isWhitelisted = true;
                            }
                        }
                    break;
                }
            }
            if(isWhitelisted != true) 
                return ErrorStrings.permissionError;
        }

        if(!ignoreArgs) {
            //Argument Limits
            if(props._minArgs != -1 && props._minArgs > args.length)
                return new ErrorMessageResponse(ErrorStrings.minArgLimit);
            if(props._maxArgs != -1 && props._maxArgs < args.length) 
                return new ErrorMessageResponse(ErrorStrings.maxArgsLimit);
        }
        return true;
    }
}

class DefaultAlias {
    constructor(name, link) {
        this._name = name;
        this._isAlias = true;
        this._link = link;
    }

    exec(message, args) {
        return this._link.exec(message, args);
    }
}

class CommandProperty {
    constructor(commandName) {
        this._details = new CommandDetails("No Description", "No Usage");
        this._command = commandName;
        this._minArgs = -1;
        this._maxArgs = -1;
        this._allowDM = true;
        //Fixed permissions means the permissions are not handled by the database
        this._fixedPermissions = true;
        /*Permissions have the following allowed entries:
            type: user, channel or role
            id: user id, channel id or role id. Can also be wildcard
            allowed: true/false - defaults to this._permissionDefault, and determines wether this rule is block or allow
        Permissions also follow the following rules:
            Whitelist is checked first, followed by blacklist
            If a user is on whitelist AND blacklist, blacklist takes preference
            Priority for whitelisting: role -> user
                IF the role || user is allowed, allow
                IF user is on both lists, force user to blacklist temporarily, repeatedly demand solution.
            Priority for blacklisting: user -> channel
                IF user || channel is blocked, deny

            Format: {type: "user/channel/role", id: "user id/channel id/role id"}
            For type: "role", there is also an additional optional property, 'exact': true/false
            If exact is true, the user must have the role
            If exact is false, if the user has a higher role, they will be able to use the commands.
        */
        //If this._fixedPermissions is false, this will be used as a default, then immediately overwritten.
        this._whitelist = [{type: "user", id: Config.owner}];
        this._blacklist = [];

        //this._useWhitelist:
        //  true: Only rules defined in whitelist are allowed, overridden by blacklist, default deny
        //  false: Default allow, blacklist is now used.
        this._useWhitelist = true;
    }

    _updatePermissions(mgr) {
        let dbSys = mgr.getSystem("Database");
        let dbRet = dbSys.getDatabase("cmd_lists");
        let db = dbRet.getData();
        if(db == null) {
            this._whitelist = [];
            this._blacklist = [];
            Utils.log(`CommandProperty ${this._command}`, "Failed to load whitelist database");
            return false;
        }
        if(db[this._command] == null) {
            db[this._command] = {whitelist: this._whitelist, blacklist: this._blacklist};
            Utils.log(`CommandProperty ${this._command}`, "Permission data does not exist, creating with default permissions.");
            dbSys.commit(dbRet);
        }
        this._whitelist = db[this._command].whitelist;
        this._blacklist = db[this._command].blacklist;
        Utils.log(`CommandProperty ${this._command}`, "Loaded permissions data");
    }

    savePermissions(mgr) {
        let dbSys = mgr.getSystem("Database");
        let dbRet = dbSys.getDatabase("cmd_lists");
        let db = dbRet.getData();
        db[this._command] = {whitelist: this._whitelist, blacklist: this._blacklist};
        Utils.log(`CommandProperty ${this._command}`, "Saved new permissions to database");
        dbSys.commit(dbRet);
    }

    setArgs(min, max) {
        this._minArgs = min;
        this._maxArgs = max;
        return this;
    }

    noArgs() {
        this._minArgs = -1;
        this._maxArgs = -1;
        return this;
    }

    allowDM(dm) {
        //this._allowDM = dm;
        Utils.log(`CommandProperty ${this._command}`, "Attempted to use allowDM(), this function does nothing.")
        return this;
    }

    setFixedPermissions(val) {
        this._fixedPermissions = val;
        return this;
    }

    addWhitelist(type, property, exact=false) {
        let types = ["role", "user"];
        if(!types.includes(type)) {
            Utils.log(`Command:${this._command}`, `:::WARNING::: Whitelist specifies property that does not exist.`);
            return this;
        }
        let obj = {type: type, id: property};
        if(type == "role")
            obj.exact = exact;
        this._whitelist.push(obj);
    }

    addBlacklist(type, property) {
        let types = ["channel", "user"];
        if(!types.includes(type)) {
            Utils.log(`Command:${this._command}`, `:::WARNING::: Blacklist specifies property that does not exist.`);
            return this;
        }
        let obj = {type: type, id: property};
        this._blacklist.push(obj);
    }

    forceWhitelist(val) {
        this._useWhitelist = val;
        return this;
    }

    setDetails(deets) {
        this._details = deets;
        return this;
    }
}

class CommandDetails {
    constructor(desc, usage) {
        this._description = desc;
        this._usage = usage;
    }

    getUsageFormatted(cmd) {
        let nums = this._usage.split("\n");
        let concat = "";
        for(let i in nums) {
            concat = concat + `${cmd} ${nums[i]}\n`;
        }
        return concat;
    }
}

module.exports = {DefaultCommand, DefaultAlias, CommandProperty, CommandDetails};