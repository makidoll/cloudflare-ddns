var request = require("request");
var settings = require(__dirname+"/settings.js");
var cloudflare = require("cloudflare")({
	email: settings.cloudflare.email,
	key: settings.cloudflare.key,
});

function timeLog(msg) {
	console.log("["+moment().format("HH:mm:ss DD/MM/YY")+"] "+msg);
}

function getInfo(callback) {
	timeLog("Retrieving info from Cloudflare...")

	// finding and saving zone
	cloudflare.zones.browse().then(zones => {
		for (var i=0; i<zones.result.length; i++) {
			let zone = zones.result[i];
			if (zone.name != settings.zone.name) continue;

			settings.zone.id = zone.id;
			timeLog(settings.zone.name+" found with ID: "+settings.zone.id);

			// finding and saving records
			settings.zone.found = {};
			cloudflare.dnsRecords.browse(settings.zone.id).then(records => {
				for (var i=0; i<records.result.length; i++) {
					let record = records.result[i];
					if (!settings.zone.records.includes(record.name)) continue;

					settings.zone.found[record.id] = record.name;
					timeLog("\t"+record.name+" found with ID: "+record.id);
				}
				timeLog("");
				timeLog("Complete! Starting public IP checking at an interval of: "+
					settings.interval+" minutes...");

				return callback();
			});
		}
	}).catch(err => {		
		// zone not found
		if (!settings.zone.id) {
			timeLog(settings.zone.name+" could not be found.");
			process.exit();
		}
	});
}

function updateIP() {
	request("https://canihazip.com/s", function(err, res, ip) {
		if (err) return timeLog("Error retrieving public IP.");
		if (settings.ip == ip) return; 

		settings.ip = ip;
		timeLog("New IP! ("+settings.ip+") Updating records...");
		for (var i=0; i<Object.keys(settings.zone.found).length; i++) {
			let id = Object.keys(settings.zone.found)[i];
			let name = settings.zone.found[id];

			cloudflare.dnsRecords.read(settings.zone.id, id).then(record => {
				name = settings.zone.found[id] = record.result.name;

				if (record.result.content == settings.ip) {
					timeLog("\t"+name+" already updated.")
				}

				cloudflare.dnsRecords.edit(settings.zone.id,
					id, record.result).then(() => {
					timeLog("\t"+name+" updated!");
				}).catch(err => {
					timeLog("\t"+name+" errored whilst updating!");
				});
			});
		}
	});
}

getInfo(function() {
	setInterval(function() {
		updateIP();
	}, settings.interval*60*1000);
	updateIP();
});