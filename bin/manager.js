const Utils = new require('./util');
const EventEmitter = require('events');
const fs = require('fs');

//Implements any classes found in the ./bin/systems folder
//Systems implement the DefaultSystem class
/**
 * @typedef {import('discord.js').Client} DiscordClient
 * @typedef {import('./system')} DefaultSystem
 */

class Manager extends EventEmitter {
    /**
     * 
     * @param {DiscordClient} client 
     */
    constructor(client) {
        super();
        this._discordClient = client;
        this._timerManager = null;
        this._discordAlive = false;
        this._firstAlive = null;
        this._events = ["messageOther"];

        this._systems = {};
    }

    init() {
        this._timerManager = new TimerManager(this);
        this.on("newListener", (event, listener) => {
            if(!this._events.includes(event)) {
                this.removeListener(event, listener);
                this._discordClient.on(event, listener);
                Utils.log("Manager", "Discord Event '" + event + "' was registered.");
            }
        });

        this._initializeEvents();

        let systems = fs.readdirSync('./bin/systems'); //Local to master script
		
		//Using function(file) here changes the context of 'this'
		systems.forEach((file) => {
			if(file.substr(file.length - 3) == ".js") {
                let sysClass = require('./systems/' + file);
                Utils.log("Systems", "Pre-Initializing " + file);
				let sys = new sysClass(this);
                sys.preinit();
                this._systems[sys._identity] = sys;
			}
        });
        
        for(let sys in this._systems) {
            this._systems[sys].init();
        }
        Utils.log("Systems", "Intialized All Systems");
        for(let sys in this._systems) {
            this._systems[sys].postinit();
        }
        Utils.log("Systems", "Post-Intialized All Systems");
    }

    _initializeEvents() {
        //MessageOther event, triggers when a message is sent by anyone but itself
        this._discordClient.on("message", (msg) => {
            if(msg.author.id != this._discordClient.user.id)
                this.emit("messageOther", msg);
        })
    }

    discordOn() {
        this._discordAlive = true;
        if(this._firstAlive == null)
            this._firstAlive = true;
    }

    discordOff() {
        this._discordAlive = false;
        this._firstAlive = false;
    }

    /**
     * Checks if the client is connected to discord or destroyed
     * @returns {boolean} Returns true if available
     */
    checkClientActive() {
        if(this._discordClient == null || !this._discordAlive)
            return false;
        return true;
    }

    /**
     * Checks if this is the first time the client has connected to discord
     * @returns {boolean}
     */
    checkClientFirst() {
        if(this._firstAlive == true || this._firstAlive == null)
            return true;
        return false;
    }

    /**
     * Returns the system located by identity, or null
     * @param {string} identity The identity the system is initialized as
     * @returns {DefaultSystem} The system that is requested.
     */
    getSystem(identity) {
        if(this._systems[identity] != null)
            return this._systems[identity];
        else
            return null;
    }
}

class TimerManager {
    /**
     * 
     * @param {Manager} manager 
     */
    constructor(manager) {
        this._timers = {};
        this.interval = 100;
        this._timers.global = {};
        this._manager = manager;

        //Local skipped is the amount of failed timers since the last successful timer
        //Total skipped is all failed timers.
        this._localSkipped = 0;
        this._totalSkipped = 0;
        setInterval(() => this._runAll(), this.interval);
    }

    _runAll() {
        if(this._manager.checkClientActive()) {
            for(let table in this._timers) {
                for(let timer in this._timers[table]) {
                    let func = () => {
                        this._timers[table][timer].run();
                    }
                    func();
                }
            }
            this._localSkipped = 0;
        } else {
            if(!this._manager.checkClientFirst()) {
                this._localSkipped++;
                this._totalSkipped++;
                Utils.log("TimerManager", `Skipped ${this._localSkipped} timer cycles, total skipped is ${this._totalSkipped}`);
            }
        }
    }

    /**
     * 
     * @param {string} id 
     * @param {number} interval 
     * @param {function} func
     */
    setGlobalTimer(id, interval, func) {
        this._timers.global[id] = new Timer(interval, func);
        return id;
    }

    /**
     * 
     * @param {number} interval 
     * @param {function} func
     */
    addGlobalTimer(interval, func) {
        let curID = 0;
        while(this._timers.global[curID] != null)
            curID++;
        this.setGlobalTimer(curID, interval, func);
        return curID;
    }

    /**
     * 
     * @param {string} table 
     * @param {string} id 
     * @param {number} interval 
     * @param {function} func
     */
    setTimer(table, id, interval, func) {
        if(this._timers[table] == null)
            this._timers[table] = {};
        this._timers[table][id] = new Timer(interval, func);
        return id;
    }

    /**
     * 
     * @param {string} table 
     * @param {number} interval 
     * @param {function} func
     */
    addTimer(table, interval, func) {
        if(this._timers[table] == null)
            this._timers[table] = {};
        let curID = 0;
        while(this._timers[table][curID] != null)
            curID++;
        this.setTimer(table, curID, interval, func);
        return curID;
    }


}

class Timer {
    /**
     * 
     * @param {number} interval 
     * @param {function} func
     */
    constructor(interval, func) {
        this.interval = interval;
        this.nextTime = (process.uptime() * 1000) + interval;
        this.function = func;
    }

    run() {
        if(process.uptime() * 1000 >= this.nextTime) {
            this.runFunction();
            this.nextTime = (process.uptime() * 1000) + this.interval;
        }
    }

    runFunction() {
        this.function();
    }
}

module.exports = Manager;