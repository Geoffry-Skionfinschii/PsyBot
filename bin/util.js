const dateFormat = require("dateformat");

class Utils {
    /**
     * Logs anything, provide the name to display, then comma seperated similar to console.log
     * @param {string} provClass Name to display in log
     */
    static log(provClass) {
        if(provClass == null)
            provClass = "Unknown";
        
        let date = Date.now();
        let formattedDate = dateFormat(date, "isoDateTime");
		process.stdout.write(`[${formattedDate}] <${provClass}>: `);
        
        //Remove first argument (argument is not an array object, so have to do it manually)
        for (var i=0;i<arguments.length;i++) 
            arguments[i]=arguments[i+1];
        arguments.length = arguments.length - 1;

		console.log(...arguments);
	}
}

module.exports = Utils;