const {Client, RichEmbed} = require('discord.js');
const client = new Client();
const Utils = require('./bin/util');
const Config = require('./config');
const LoginDetails = require('./login').login;
const ManagerClass = require('./bin/manager');

Utils.log("main", "Startup...");

const Manager = new ManagerClass(client);
Manager.init();

client.on("ready", () => {
	client.user.setPresence({ game: { name: "for " + Config.prefix, type: 'WATCHING'}, status: 'dnd'});
	Utils.log("Client", "Client Ready");
	Manager.discordOn();
});

client.on("error", (err) => {
	killClient();
	startup();
	Utils.log("DiscordClient", "Rebooting due to error\n", err);
});

function killClient() {
	Manager.discordOff();
	client.destroy();
}

function startup() {
	client.login(LoginDetails);
}

startup();