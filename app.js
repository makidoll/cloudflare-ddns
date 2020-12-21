const dns = require("dns");
const settings = require(__dirname + "/settings.js");

function log(message) {
	const d = new Date();
	const z = n => ("0" + n).slice(-2);
	console.log(
		"[" +
			[d.getFullYear(), z(d.getMonth() + 1), z(d.getDate())].join("-") +
			" " +
			[z(d.getHours()), z(d.getMinutes()), z(d.getSeconds())].join(":") +
			"] " +
			message,
	);
}

function getMyIP() {
	return new Promise((resolve, reject) => {
		dns.resolve("ns1.google.com", (err, records) => {
			if (err) return reject(err);
			if (records.length < 1) return reject(err);
			dns.setServers([records[0]]);

			dns.resolveTxt("o-o.myaddr.l.google.com", (err, records) => {
				if (err) return reject(err);
				if (records.length < 1) return reject(err);
				if (records[0].length < 1) return reject(err);

				let ip = records[0][0];
				resolve(ip);
			});
		});
	});
}

function getInfo(cloudflare, userInfo) {
	return new Promise(async (resolve, reject) => {
		let info = [];

		// finding and saving zones
		let zones = await cloudflare.zones.browse();
		for (const zone of zones.result) {
			if (!Object.keys(userInfo).includes(zone.name)) continue;

			//log(zone.name+" found with ID: "+zone.id);
			let newZone = {
				id: zone.id,
				name: zone.name,
				records: [],
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

		info.forEach(zone => {
			log(zone.name + " found with ID: " + zone.id);
			zone.records.forEach(record => {
				log("\t" + record.name + " found with ID: " + record.id);
			});
		});

		resolve({
			cloudflare: cloudflare,
			zones: info,
		});
	});
}

let currentIP = "";

async function updateIPs(infos) {
	let ip;
	try {
		ip = await getMyIP();
	} catch (err) {
		return log("Error retrieving public IP.");
	}

	if (currentIP == ip) return;
	currentIP = ip;

	log("");
	log("New IP! (" + ip + ") Updating records...");

	for (const info of infos) {
		let cloudflare = info.cloudflare;
		for (const zone of info.zones) {
			for (let record of zone.records) {
				record = await cloudflare.dnsRecords.read(zone.id, record.id);
				if (!record.success) continue;
				record = record.result;

				if (record.content == ip) {
					log("\t" + record.name + " already updated.");
					continue;
				}

				record.content = ip;
				cloudflare.dnsRecords
					.edit(zone.id, record.id, record)
					.then(() => {
						log("\t" + record.name + " updated!");
					})
					.catch(err => {
						log("\t" + record.name + " errored whilst updating!");
					});
			}
		}
	}
}

let accounts = [];
settings.accounts.forEach(account => {
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
Promise.all(
	accounts.map(account => {
		return getInfo(account.cloudflare, account.zones);
	}),
).then(infos => {
	log("");
	log(
		"Complete! Starting public IP checking at an interval of " +
			settings.interval +
			" minutes...",
	);

	setInterval(() => {
		updateIPs(infos);
	}, settings.interval * 60 * 1000);
	updateIPs(infos);
});
