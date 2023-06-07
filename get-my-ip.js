// const dns = require("dns");
const axios = require("axios");

const validateIpv4 = ip =>
	// https://www.oreilly.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
	// it seems that [0-255] does 0-2, 5 and 5 instead :(
	/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
		ip,
	);

async function getMyIp(ipv6 = false) {
	// return new Promise((resolve, reject) => {
	// 	(ipv6 ? dns.resolve6 : dns.resolve4)(
	// 		"ns1.google.com",
	// 		(err, records) => {
	// 			if (err) return reject(err);
	// 			if (records.length < 1) return reject(err);
	// 			// console.log(records);
	// 			dns.setServers([records[0]]);
	// 			dns.resolveTxt("o-o.myaddr.l.google.com", (err, records) => {
	// 				if (err) return reject(err);
	// 				if (records.length < 1) return reject(err);
	// 				if (records[0].length < 1) return reject(err);
	// 				const ip = records[0][0];
	// 				return resolve(ip);
	// 			});
	// 		},
	// 	);
	// });

	// http doesnt redirect and replies faster
	const res = await axios(
		"http://api" + (ipv6 ? "64" : "") + ".ipify.org?format=json",
	);

	// if (!res.ok) throw new Error("Failed to get IP from host");

	const ip = (res.data?.ip ?? "").trim();
	if (ip == null) throw new Error("Failed to get IP from response");

	const validIpv4 = validateIpv4(ip);

	if (!ipv6 && !validIpv4) throw new Error("Failed to get valid IPv4");
	if (ipv6 && validIpv4) throw new Error("Failed to get valid IPv6");

	return ip;
}

module.exports.getMyIp = getMyIp;

// (async () => {
// 	console.log(await getMyIp(false));
// 	console.log(await getMyIp(true));
// })();
