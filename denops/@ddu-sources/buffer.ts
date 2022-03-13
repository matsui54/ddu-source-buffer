import {
  ActionArguments,
  ActionFlags,
  BaseSource,
  Item,
} from "https://deno.land/x/ddu_vim@v1.2.0/types.ts";
import {
  batch,
  Denops,
  fn,
  gather,
} from "https://deno.land/x/ddu_vim@v1.2.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.0/file.ts";

type Params = Record<never, never>;

export class Source extends BaseSource<Params> {
  kind = "file";

  gather(args: {
    denops: Denops;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const buffers: number[] = [];
        const currentBuf = await fn.bufnr(args.denops, "%");
        const altBuf = await fn.bufnr(args.denops, "#");
        if (currentBuf != -1) {
          buffers.push(currentBuf);
        }
        if (altBuf != -1) {
          buffers.push(altBuf);
        }
        const listed = await args.denops.eval(
          "filter(range(1, bufnr('$')), {_, bufnr -> bufexists(bufnr) && buflisted(bufnr)})",
        ) as number[];
        for (const l of listed) {
          if (!buffers.includes(l)) {
            buffers.push(l);
          }
        }

        const items: Item<ActionData>[] = [];
        for (const b of buffers) {
          const [name, modified] = await gather(
            args.denops,
            async (denops: Denops) => {
              await fn.bufname(denops, b);
              await fn.getbufvar(denops, b, "&modified");
            },
          );

          const kindMarker = (b == currentBuf)
            ? "%"
            : (b == altBuf)
            ? "#"
            : " ";
          const modmarker = modified ? "+" : " ";

          items.push({
            word: `${b} ${kindMarker} ${modmarker} ${name || "[No Name]"}`,
            action: {
              bufNr: b,
            },
          });
        }

        controller.enqueue(
          items,
        );
        controller.close();
      },
    });
  }

  actions = {
    delete: async ({ denops, items }: ActionArguments<Params>) => {
      for (const item of items) {
        const action = item?.action as ActionData;
        if (item.action) {
          try {
            await denops.cmd(`bdelete! ${action.bufNr}`);
          } catch (e) {
            console.log(e);
          }
        }
      }
      return Promise.resolve(ActionFlags.RefreshItems);
    },
  };

  params(): Params {
    return {};
  }
}
