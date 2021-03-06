/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-eval */
import { CommandOptions, Command, Args } from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { Message, MessageEmbed } from "discord.js";
import { inspect } from "util";
import { codeBlock } from "@discordjs/builders";
import { send } from "@sapphire/plugin-editable-commands";
import { Util } from "../../utils/Util";

@ApplyOptions<CommandOptions>({
    aliases: [],
    name: "eval",
    quotes: [],
    description: "Evaluate js code",
    detailedDescription: {
        usage: "{prefix}eval <some js code>"
    },
    preconditions: ["ownerOnly"],
    requiredClientPermissions: ["SEND_MESSAGES", "EMBED_LINKS"]
})
export class EvalCommand extends Command {
    public async messageRun(message: Message, args: Args): Promise<any> {
        const input = await args.restResult("string");
        if (!input.success) {
            return send(message, {
                embeds: [
                    Util.createEmbed("error", "Please provide a valid input!", true)
                ]
            });
        }
        const msg = message;
        const client = this.container.client;

        const embed = new MessageEmbed()
            .setColor("#00FF00")
            .addField("Input", codeBlock("js", input.value));

        try {
            let code = input.value;
            let isSilent = false;
            if (code.includes("--silent")) {
                isSilent = true;
                code = code.replace("--silent", "");
            }
            if (code.includes("--async")) {
                code = code.replace("--async", "");
                code = `(async () => {${code}})();`;
            }

            let evaled: string = await eval(code);
            const { type } = await EvalCommand.parseEval(code);
            if (typeof evaled !== "string") evaled = inspect(evaled, { depth: 0 });

            const output = EvalCommand.clean(evaled);
            if (output.length > 1024) {
                const hastebin = await Util.hastebin(output);
                embed.addField("Output", `${hastebin}.js`);
            } else { embed.addField("Output", `\`\`\`js\n${output}\`\`\``); }
            embed.addField("Return Type", codeBlock(type));
            if (!isSilent) return await send(message, { embeds: [embed] });
        } catch (e: any) {
            const error = EvalCommand.clean(e as string);
            if (error.length > 1024) {
                const hastebin = await Util.hastebin(error);
                embed.addField("Error", `${hastebin}.js`);
            } else { embed.setColor("#FF0000").addField("Error", `\`\`\`js\n${error}\`\`\``); }
            return await send(message, { embeds: [embed] });
        }
        return message;
    }

    public static parseType(input: any): string {
        if (input instanceof Buffer) {
            let length = Math.round(input.length / 1024 / 1024);
            let ic = "MB";
            if (!length) {
                length = Math.round(input.length / 1024);
                ic = "KB";
            }
            if (!length) {
                length = Math.round(input.length);
                ic = "Bytes";
            }
            return `Buffer (${length} ${ic})`;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return input === null || input === undefined ? "Void" : input.constructor.name;
    }

    public static async parseEval(input: any): Promise<{ evaled: string; type: string }> {
        const isPromise =
            input instanceof Promise &&
            typeof input.then === "function" &&
            typeof input.catch === "function";
        if (isPromise) {
            input = await input;
            return {
                evaled: input,
                type: `Promise<${EvalCommand.parseType(input)}>`
            };
        }
        return {
            evaled: input,
            type: EvalCommand.parseType(input)
        };
    }

    private static clean(text: string): string {
        if (typeof text === "string") {
            return text
                .replace(new RegExp(process.env.DISCORD_TOKEN!, "g"), "[REDACTED]")
                .replace(/`/g, `\`${String.fromCharCode(8203)}`)
                .replace(/@/g, `@${String.fromCharCode(8203)}`);
        }
        return text;
    }
}
