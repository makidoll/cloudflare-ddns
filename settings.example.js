module.exports = {
	interval: 5, // minutes
	ipv6: false,
	accounts: [
		{
			email: "",
			key: "",
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
