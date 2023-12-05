// @deno-types="npm:@types/fancy-log@2.0.2"
import log from "npm:fancy-log@2.0.0";
// @deno-types="npm:@types/cloudflare@2.7.13"
import Cloudflare from "npm:cloudflare@2.9.1";
import * as jsonc from "https://deno.land/std@0.208.0/jsonc/parse.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

interface Account {
	email: string;
	key: string;
	cloudflare: Cloudflare;
	zones: {
		[domain: string]: string[];
	};
}

interface Settings {
	interval: number;
	ipv6: boolean;
	accounts: Account[];
}

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const settings: Settings = jsonc.parse(
	await Deno.readTextFile(path.resolve(__dirname, "./settings.jsonc")),
	{ allowTrailingComma: true },
);

const accounts = settings.accounts.map(account => ({
	...account,
	cloudflare: new Cloudflare({
		email: account.email,
		key: account.key,
	}),
}));

const validateIpv4 = (ip: string) =>
	// https://www.oreilly.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
	// it seems that [0-255] does 0-2, 5 and 5 instead :(
	/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
		ip,
	);

async function getMyIp(ipv6 = false) {
	// alternate method is to dns resolve txt o-o.myaddr.l.google.com

	// http doesnt redirect and returns faster

	const res = await fetch(
		"http://api" + (ipv6 ? "64" : "") + ".ipify.org?format=json",
	);

	const data = await res.json();

	const ip = data.ip.trim();
	if (ip == null) throw new Error("Failed to get IP from response");

	const validIpv4 = validateIpv4(ip);

	if (!ipv6 && !validIpv4) throw new Error("Failed to get valid IPv4");
	if (ipv6 && validIpv4) throw new Error("Failed to get valid IPv6");

	return ip;
}

async function ensureRecord(
	type: "A" | "AAAA",
	content: string,
	recordName: string,
	records: Cloudflare.DnsRecord[],
	zoneId: string,
	account: Account,
) {
	const record = records.find(
		record => record.type == type && record.name == recordName,
		// && (record.type == "CAA" ? record.data.tag == "issue" : true),
	);

	const recordLog = (message: string, error: boolean = false) =>
		(error ? log.error : log)(
			"- " + type + " " + recordName + " " + message,
		);

	try {
		if (record == null) {
			// create record

			await account.cloudflare.dnsRecords.add(zoneId, {
				name: recordName,
				type,
				proxied: false,
				ttl: 0, // auto
				content,
			});

			recordLog("created");
		} else {
			// update record

			// the cloudflare types are kinda bad
			if (record.type == "SRV") return;

			if (record.content == content) {
				recordLog("doesn't need updating");
				return;
			}

			record.content = content;

			await account.cloudflare.dnsRecords.edit(
				zoneId,
				(record as any).id, // yeah they're bad
				record,
			);

			recordLog("updated");
		}
	} catch (error) {
		recordLog("failed to create or update", true);
		log.error(error);
	}
}

async function updateDnsForAccount(
	ipv4: string,
	ipv6: string,
	account: Account,
) {
	const zones = ((await account.cloudflare.zones.browse()) as any).result;

	for (const zone of zones) {
		const recordsToUpdate = account.zones[zone.name];
		if (recordsToUpdate == null) continue;

		const records = (await account.cloudflare.dnsRecords.browse(zone.id))
			.result;
		if (records == null) continue;

		for (const recordName of recordsToUpdate) {
			const args: [string, Cloudflare.DnsRecord[], string, Account] = [
				recordName,
				records,
				zone.id,
				account,
			];

			// dont need to await these

			ensureRecord("A", ipv4, ...args);
			if (ipv6 != null) ensureRecord("AAAA", ipv6, ...args);

			// if (account.caaIssue) {
			// 	ensureRecord("CAA", account.caaIssue, ...args);
			// }
		}
	}
}

let currentIpv4: string = "";
let currentIpv6: string = "";

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
		log.error(error);
	}
}

log(`Interval set to ${settings.interval} minutes`);

setInterval(() => {
	updateSafe();
}, settings.interval * 60 * 1000);
updateSafe();
