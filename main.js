const { getMyIp } = require("./get-my-ip");
const log = require("fancy-log");
const settings = require("./settings");

const accounts = settings.accounts.map(account => ({
	...account,
	cloudflare: require("cloudflare")({
		email: account.email,
		key: account.key,
	}),
}));

async function ensureRecord(
	type,
	content,
	recordName,
	records,
	zoneId,
	account,
) {
	const record = records.find(
		record => record.name == recordName && record.type == type,
		// && (record.type == "CAA" ? record.data.tag == "issue" : true),
	);

	const infoLog = message =>
		log("- " + type + " " + recordName + " " + message);

	try {
		if (record == null) {
			// create record
			const newRecord = {
				name: recordName,
				type,
				proxied: false,
				locked: false,
			};

			// if (type == "CAA") {
			// 	newRecord.data = {
			// 		flags: 0,
			// 		tag: "issue",
			// 		value: "letsencrypt.org",
			// 	};
			// } else {
			newRecord.content = content;
			// }

			await account.cloudflare.dnsRecords.add(zoneId, newRecord);

			infoLog("created");
		} else {
			// update record
			// if (record.type == "CAA") {
			// 	if (record.data.value == content) {
			// 		infoLog("doesn't need updating");
			// 		return;
			// 	}

			// 	record.data.value = content;
			// 	await account.cloudflare.dnsRecords.edit(
			// 		zoneId,
			// 		record.id,
			// 		record,
			// 	);
			// } else {
			if (record.content == content) {
				infoLog("doesn't need updating");
				return;
			}

			record.content = content;
			await account.cloudflare.dnsRecords.edit(zoneId, record.id, record);
			// }

			infoLog("updated");
		}
	} catch (error) {
		infoLog("failed to create or update");
		log.error(error);
	}
}

async function updateDnsForAccount(ipv4, ipv6, account) {
	const zones = (await account.cloudflare.zones.browse()).result;

	for (const zone of zones) {
		const recordsToUpdate = account.zones[zone.name];
		if (recordsToUpdate == null) return;

		const records = (await account.cloudflare.dnsRecords.browse(zone.id))
			.result;

		for (const recordName of recordsToUpdate) {
			const args = [recordName, records, zone.id, account];
			// dont need to await these

			ensureRecord("A", ipv4, ...args);
			if (ipv6 != null) ensureRecord("AAAA", ipv6, ...args);

			// if (account.caaIssue) {
			// 	ensureRecord("CAA", account.caaIssue, ...args);
			// }
		}
	}
}

let currentIpv4 = null;
let currentIpv6 = null;

async function update() {
	const ipv4 = await getMyIp();
	const ipv6 = settings.ipv6 ? await getMyIp(true) : null;

	if (currentIpv4 != ipv4 || currentIpv6 != ipv6) {
		log("New IPv4 address: " + ipv4);
		if (settings.ipv6) log("New IPv6 address: " + ipv6);

		currentIpv4 = ipv4;
		currentIpv6 = ipv6;

		for (const account of accounts) {
			await updateDnsForAccount(ipv4, ipv6, account);
		}
	} else {
		// log("IP address hasn't changed");
	}
}

function updateSafe() {
	try {
		update();
	} catch (error) {
		console.error(error);
	}
}

setInterval(() => {
	updateSafe();
}, settings.interval * 60 * 1000);
updateSafe();
