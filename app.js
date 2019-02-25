var moment = require("moment");
var request = require("request");
var settings = require(__dirname+"/settings.js");

function log(msg) {
	console.log("["+moment().format("HH:mm:ss DD/MM/YY")+"] "+msg);
}

function getInfo(cloudflare, userInfo) {
	return new Promise(async (resolve,reject)=>{
		let info = [];

		// finding and saving zones
		let zones = await cloudflare.zones.browse();
		for (const zone of zones.result) {
			if (!Object.keys(userInfo).includes(zone.name)) continue;

			//log(zone.name+" found with ID: "+zone.id);
			let newZone = {
				id: zone.id,
				name: zone.name,
				records: []
			};

			// finding and saving records
			let records = await cloudflare.dnsRecords.browse(zone.id);
			for (const record of records.result) {
				if (record.type != "A") continue;
				if (!userInfo[zone.name].includes(record.name)) continue;

				//log("\t"+record.name+" found with ID: "+record.id);
				newZone.records.push({
					id: record.id,
					name: record.name,
				});
			}


			info.push(newZone);
		}

		info.forEach(zone=>{
			log(zone.name+" found with ID: "+zone.id);
			zone.records.forEach(record=>{
				log("\t"+record.name+" found with ID: "+record.id);
			});
		});

		resolve({
			cloudflare: cloudflare,
			zones: info
		});
	});
}

function updateIPs(infos) {
	request("https://canihazip.com/s", async (err, res, ip)=>{
		if (err) return log("Error retrieving public IP.");
		if (settings.ip == ip) return;

		settings.ip = ip;
		log("");
		log("New IP! ("+settings.ip+") Updating records...");



		for (const info of infos) {
			let cloudflare = info.cloudflare;
			for (const zone of info.zones) {
				for (let record of zone.records) {
					record = await cloudflare.dnsRecords.read(zone.id, record.id);
					if (!record.success) continue;
					record = record.result;

					if (record.content == settings.ip) {
						log("\t"+record.name+" already updated.")
						continue;
					}

					record.content = settings.ip;
					cloudflare.dnsRecords.edit(zone.id, record.id, record).then(()=>{
						log("\t"+record.name+" updated!");
					}).catch(err => {
						log("\t"+record.name+" errored whilst updating!");
					});
				}
			}
		}
	});
}

let accounts = []; 

settings.accounts.forEach(account=>{
	accounts.push({
		zones: account.zones,
		cloudflare: require("cloudflare")({
			email: account.email,
			key: account.key,
		}),
	});
});

log("Retrieving info from Cloudflare...");
log("");
Promise.all(accounts.map(account=>{
	return getInfo(account.cloudflare, account.zones);
})).then(infos=>{

	log("")
	log("Complete! Starting public IP checking at an interval of "+
		settings.interval+" minutes...");

	setInterval(()=>{
		updateIPs(infos);
	}, settings.interval*60*1000);
	updateIPs(infos);
});