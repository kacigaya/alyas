import { randomBytes, scryptSync } from "node:crypto";

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return (await new Response(Bun.stdin.stream()).text()).trimEnd();
  if (!process.stdin.setRawMode) throw new Error("This terminal cannot hide password input.");

  process.stdout.write("Password: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          finish();
          reject(new Error("Cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (character === "\u007f") {
          if (value) {
            value = [...value].slice(0, -1).join("");
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          process.stdout.write("*");
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

const password = await readPassword();
if (!password) {
  console.error("Password cannot be empty.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
console.log(`${salt}:${scryptSync(password, salt, 64).toString("hex")}`);
