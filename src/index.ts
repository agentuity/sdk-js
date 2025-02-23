export * from "./server";
export * from "./logger";
export * from "./types";

async function main() {
	if (
		process.env.AGENTUITY_SDK_AUTORUN === "true" &&
		!!process.env.AGENTUITY_SDK_DIR
	) {
		const runner = await import("./autostart");
		await runner.run(
			process.env.AGENTUITY_SDK_DIR,
			process.env.AGENTUITY_SDK_DIST_DIR,
		);
	}
}

main();
