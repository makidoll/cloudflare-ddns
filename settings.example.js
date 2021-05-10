module.exports = {
	interval: 5, // minutes
	ipv6: false,
	accounts: [
		{
			email: "",
			key: "",
			caaIssue: "", // leave empty and no caa certs will be made
			zones: {
				"example.com": [
					"example.com",
					"www.example.com",
					"*.example.com",
				],
			},
		},
	],
};
