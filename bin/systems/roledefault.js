const DefaultSystem = require('../system');
const fs = require('fs');
const Config = require('../../config')
const Utils = require('../util');

/**
 * @typedef {import('discord.js').GuildMember} GuildMember
 * @typedef {import('discord.js').Guild} Guild
 * @typedef {import('../systems/database')} Database
 */


class RoleSystem extends DefaultSystem {
    constructor(client) {
        super(client, "RoleDefault");
    }

    init() {
        this._manager.on('guildMemberAdd', (newMember) => this._handleConnect(newMember));
    }

    postinit() {
    }

    /**
     * Handles a connection event
     * @param {GuildMember} newMember 
     */
    async _handleConnect(newMember) {
        newMember.addRole(newMember.guild.roles.find((val) => val.name == "default"));
    }
}

module.exports = RoleSystem;