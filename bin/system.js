

class DefaultSystem {

    //Init function is where the system can set up its own values.
    //It will be passed the TimingManager class where it can add new timers

    /**
     * @typedef {import('./manager')} Manager
     * @param {Manager} mgr 
     * @param {string} systemName 
     */
    constructor(mgr, systemName) {
        this._manager = mgr;
        this._identity = systemName;
    }

    //Ran before all systems are added
    preinit() {}

    //Ran when all systems are added
    init() {}

    //Ran after all systems are initialized
    postinit() {}

}

module.exports = DefaultSystem;