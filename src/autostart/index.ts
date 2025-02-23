import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createServer, createServerContext } from "../server";
import { registerOtel } from "../otel";

export async function run(basedir: string, distdir?: string) {
	const pkg = join(basedir, "package.json");
	if (!existsSync(pkg)) {
		throw new Error(`${pkg} does not exist`);
	}
	let directory = distdir;
	if (!directory) {
		directory = join(basedir, "dist/src/agents");
	}
	if (!existsSync(directory)) {
		throw new Error(`${directory} does not exist`);
	}
	const { name, version } = JSON.parse(readFileSync(pkg, "utf8"));
	const otel = registerOtel({
		name,
		version,
	});
	const server = await createServer({
		context: createServerContext(otel),
		directory,
		port: Number.parseInt(process.env.PORT ?? "3000"),
		logger: otel.logger,
	});
	await server.start();
	const shutdown = async () => {
		await server.stop();
		await otel.shutdown();
	};
	process.on("beforeExit", shutdown);
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
	process.on("SIGQUIT", shutdown);
}
