const DefaultSystem = require('../system');
const fs = require('fs');
const Config = require('../../config')
const Utils = require('../util');

class DatabaseSystem extends DefaultSystem {
    constructor(client) {
        super(client, "Database");
        
        this._database = {};
    }

    preinit() {
        if(!fs.existsSync(Config.database.storageDir))
            fs.mkdirSync(Config.database.storageDir);
    }

    init() {
        //Automatic saving is not needed to run often at this time because of commit(); Default time is set to 1 minute
        this._manager._timerManager.addGlobalTimer(Config.database.saveDelay * 1000, () => this._saveAll());
    }

    //Database must be prepared before use. Will create a new database if not exist or corrupt
    prepareDatabase(table) {
        if(this._database[table] == null) {
            let ret = this._load(table);
            if(ret == null) {
                this._database[table] = new DatabaseStore(table);
                this._save(this._database[table]);
            }
        }
    }

    getDatabase(table) {
        if(this._database[table] != null)
            return this._database[table]; //May be null, or the data.
        return null;
    }

    commit(table) {
        this._save(table);
    }

    _fsConv(table) {
        return Config.database.storageDir + table + '.json';
    }

    _saveAll() {
        for(let store in this._database) {
            this._save(this._database[store], true);
        }
    }

    _save(db, silent=false) {
        //Backup, then write new db data.
        if(fs.existsSync(this._fsConv(db.getName()))) 
            fs.copyFileSync(this._fsConv(db.getName()), this._fsConv(Config.database.backupPrefix + db.getName()));
        fs.writeFileSync(this._fsConv(db.getName()), JSON.stringify(db));
        if(!silent)
            Utils.log("Database", `Saved ${db._name}`);
    }

    _load(db) {
        Utils.log("Database", `Loading database '${db}'`);
        let dbJSON = this._fullLoad(db);
        //If it isn't null we know its valid now, and we can now convert to a DatabaseStore and save to current memory.
        if(dbJSON != null) {
            this._database[db] = new DatabaseStore(dbJSON._name, dbJSON._data);
            return true;
        } else {
            Utils.log("Database", `Database _load() returned null for '${db}'`);
            return null;
        }
    }

    _fullLoad(db) {
        let mainCorr = false;
        let secCorr = false;
        if(!fs.existsSync(this._fsConv(db))) {
            mainCorr = true;
            Utils.log("Database", `Cannot find main db file ${this._fsConv(db)}.`)
        }
        if(!fs.existsSync(this._fsConv(Config.database.backupPrefix + db))) {
            secCorr = true;
            Utils.log("Database", `Cannot find backup db file ${this._fsConv(Config.database.backupPrefix + db)}.`)
        }

        if(!mainCorr) {
            let dbString = this._readFile(this._fsConv(db));
            let dbJSON = JSON.parse(dbString);
            if(dbJSON._name != null)
                return dbJSON;
            mainCorr = true;
            Utils.log("Database", `Main file '${this._fsConv(db)}' is invalid.`);
        }
        if(!secCorr) {
            let dbString = this._readFile(this._fsConv(Config.database.backupPrefix + db));
            let dbJSON = JSON.parse(dbString);
            if(dbJSON._name != null)
                return dbJSON;
            secCorr = true;
            Utils.log("Database", `Backup file '${this._fsConv(Config.database.backupPrefix + db)}' is invalid. ::::WARNING::::`);
        }
        Utils.log("Database", `Failed to find/recover database ${db}.`);
        //Both are corrupt, bad stuff now.
        return null;
    }

    _readFile(file) {
        return fs.readFileSync(file, {encoding: 'utf8'});
    }
}

class DatabaseStore {
    constructor(name, data={}) {
        this._name = name;
        this._data = data;
    }

    getName() {
        return this._name;
    }

    getData() {
        return this._data;
    }
}

module.exports = DatabaseSystem;