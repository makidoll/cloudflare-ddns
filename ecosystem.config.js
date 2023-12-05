module.exports = {
	apps: [
		{
			name: "Cloudflare DDNS",
			interpreter: "deno",
			interpreter_args: "run -A",
			script: "main.ts",
		},
	],
};
