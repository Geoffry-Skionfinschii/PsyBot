const Config = require("../../config");
const ErrorStrings = require("../../errors").commands;
const Utils = require("../util");
const {SimpleMessageResponse, ErrorMessageResponse, NoneMessageResponse} = require('../messageresponse');

//JSDocs
/**
 * @typedef {import('discord.js').Message} DiscordMessage
 * @typedef {import('../manager')} Manager
 * @typedef {import('../systems/database')} Database 
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
     * Executes the command
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     * @returns {SimpleMessageResponse}
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
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     * @returns {SimpleMessageResponse} Must return a new MessageResponse
     */
    run(message, args) {
        return new ErrorMessageResponse("Not Implemented: Run()");
    }

    getDetails() {
        return this._properties._details;
    }

    getWhitelist() {
        return this._properties._whitelist;
    }

    getBlacklist() {
        return this._properties._blacklist;
    }

    //Can be overridden, must return string error or true. False will fail without error.
    /**
     * Checks whether a user/message is allowed to run.
     * @param {DiscordMessage} message 
     * @param {string[]} args Can be null if ignoreArgs is true
     * @param {boolean} ignoreArgs If this is true, args is not required and will only check the user permissions.
     */
    checkProperties(message, args, ignoreArgs=false) {
        //Channel type
        if(!props._allowDM && message.channel.type == "dm")
            return ErrorStrings.dmDisabled;

        if(message.channel.type == "dm") {
            let guild = Utils.getGuild(this._manager._discordClient);
            let member = guild.members.find((member) => member.user.id == message.author.id);
            if(member == null)
                return ErrorStrings.dmCouldNotFindMember;
            
            message.member = member;
            message.guild = guild;
        }

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
                return ErrorStrings.minArgLimit;
            if(props._maxArgs != -1 && props._maxArgs < args.length) 
                return ErrorStrings.maxArgLimit;
        }
        return true;
    }
}

class DefaultAlias {
    /**
     * 
     * @param {string} name 
     * @param {DefaultCommand} link 
     */
    constructor(name, link) {
        this._name = name;
        this._isAlias = true;
        this._link = link;
    }

    /**
     * Executes the linked command
     * @param {DiscordMessage} message 
     * @param {string[]} args 
     * @returns {SimpleMessageResponse}
     */
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
        this._allowDM = false;
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
        /** @type {{type: string, id: string}[]} */
        this._whitelist = [];
        /** @type {{type: string, id: string}[]} */
        this._blacklist = [];

        //this._useWhitelist:
        //  true: Only rules defined in whitelist are allowed, overridden by blacklist, default deny
        //  false: Default allow, blacklist is now used.
        this._useWhitelist = true;
    }

    /**
     * Updates the permissions of the command from database
     * @param {Manager} mgr 
     */
    _updatePermissions(mgr) {
        /**@type {Database} */
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


    /**
     * Saves updated permissions from memory to database
     * @param {Manager} mgr
     */
    savePermissions(mgr) {
        /** @type {Database} */
        let dbSys = mgr.getSystem("Database");
        let dbRet = dbSys.getDatabase("cmd_lists");
        let db = dbRet.getData();
        db[this._command] = {whitelist: this._whitelist, blacklist: this._blacklist};
        Utils.log(`CommandProperty ${this._command}`, "Saved new permissions to database");
        dbSys.commit(dbRet);
    }

    /**
     * Sets argument minimum and maximum (-1 for no check)
     * @param {number} min 
     * @param {number} max 
     * @returns {CommandProperty}
     */
    setArgs(min, max) {
        this._minArgs = min;
        this._maxArgs = max;
        return this;
    }

    /**
     * No argument limits exist.
     * @returns {CommandProperty}
     */
    noArgs() {
        this._minArgs = -1;
        this._maxArgs = -1;
        return this;
    }

    /**
     * Sets whether this command will work in DM
     * @param {boolean} dm
     * @returns {CommandProperty}
     */
    allowDM(dm) {
        this._allowDM = dm;
        return this;
    }

    /**
     * Sets whether to use the database for permissions
     * @param {boolean} val
     * @returns {CommandProperty} 
     */
    setFixedPermissions(val) {
        this._fixedPermissions = val;
        return this;
    }

    /**
     * Adds a new entry to the whitelist
     * @param {'role' | 'user'} type 
     * @param {string} property 
     * @param {boolean} exact If the type is 'role', exact means the user MUST have the role to use the command. Otherwise the user must just be above the role.
     * @returns {CommandProperty}
     */
    addWhitelist(type, property, exact=false) {
        let types = ["role", "user"];
        if(!types.includes(type)) {
            Utils.log(`Command:${this._command}`, `:::WARNING::: Whitelist specifies property that does not exist.`);
            return this;
        }
        let obj = {type: type, id: property};
        if(type == "role")
            obj.exact = exact;
        
        let doesInclude = false;
        let removeID = 0;
        for(let i in this._whitelist) {
            let test = {type: this._whitelist[i].type, id: this._whitelist[i].id};
            if(test.type == obj.type && test.id == obj.id) {
                doesInclude = true;
                removeID = i;
                break;
            }
        }
        
        if(doesInclude) {
            Utils.log(`Command:${this._command}`, `Attempted to add identical whitelist entry, deleting old entry...`);
            this._whitelist.splice(removeID);
        }
        //Set after identical, we don't want exact and not exact to both be in whitelist
        
        //Check for a blacklist duplicate entry!
        for(let i in this._blacklist) {
            let entry = this._blacklist[i];
            if(entry.type == obj.type && entry.id == obj.id) {
                Utils.log(`Command:${this._command}`, `Whitelisted entry has a blacklist entry, removing...`);
                this._blacklist.splice(i);
            }
        }
        this._whitelist.push(obj);
    }

    /**
     * Adds a new entry to the whitelist
     * @param {'channel' | 'user'} type 
     * @param {string} property 
     * @returns {CommandProperty}
     */
    addBlacklist(type, property) {
        let types = ["channel", "user"];
        if(!types.includes(type)) {
            Utils.log(`Command:${this._command}`, `:::WARNING::: Blacklist specifies property that does not exist.`);
            return this;
        }
        let obj = {type: type, id: property};
        if(this._blacklist.includes(obj)) {
            Utils.log(`Command:${this._command}`, `Attempted to add identical blacklist entry`);
            return true;
        }
        //Check for a whitelist duplicate entry!
        for(let i in this._whitelist) {
            let entry = this._whitelist[i];
            if(entry.type == obj.type && entry.id == obj.id) {
                Utils.log(`Command:${this._command}`, `Blacklisted entry has a whitelist entry, removing...`);
                this._whitelist.splice(i);
            }
        }
        this._blacklist.push(obj);
    }

    /**
     * Resets the permission lists. DOES NOT SAVE TO DATABASE
     */
    resetPermissions() {
        this._whitelist = [];
        this._blacklist = [];
    }

    /**
     * If false, the whitelist is ignored.
     * @param {boolean} val 
     * @returns {CommandProperty}
     */
    forceWhitelist(val) {
        this._useWhitelist = val;
        return this;
    }

    /**
     * 
     * @param {CommandDetails} deets 
     * @returns {CommandProperty}
     */
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

    /**
     * Returns a formatted version of the usage(s).
     * @param {string} cmd The name of the command
     */
    getUsageFormatted(cmd) {
        let nums = this._usage.split("\n");
        let concat = "";
        for(let i in nums) {
            concat = concat + `${cmd} ${nums[i]}\n`;
        }
        return concat;
    }
}

module.exports = {
    DefaultCommand, 
    DefaultAlias, 
    CommandProperty, 
    CommandDetails
};