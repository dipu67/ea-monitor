import { prisma } from "./db.js";
import { fx } from "./fxClient.js";
import type { APITwitterStatus, ProfileStatusesOptions } from "./fxTwitter/types.js";
import { log, sleep } from "./util.js";

export interface NewTweet {
  projectId: string;
  username: string;
  tweet: APITwitterStatus;
}

export async function monitor(includeReplies = false): Promise<NewTweet[]> {
  const projects = await prisma.project.findMany();
  const found: NewTweet[] = [];

  for (const [index, project] of projects.entries()) {
    if (index > 0) await sleep(400);

    const options: ProfileStatusesOptions = { count: 20 };
    if (includeReplies) options.withReplies = true;
    if (project.cursor) options.cursor = project.cursor;

    try {
      const res = await fx.getProfileStatuses(project.username, options);
      if (res === null) continue;
      if (res.code !== 200) {
        log(`@${project.username} status ${res.code}`);
        continue;
      }

      if (res.cursor.top && res.cursor.top !== project.cursor) {
        await prisma.project.update({
          where: { username: project.username },
          data: { cursor: res.cursor.top },
        });
      }

      const fresh = res.results.filter((tweet) => {
        if (!includeReplies && tweet.replying_to) return false;
        return true;
      });

      if (fresh.length === 0) continue;

      fresh.sort((a, b) => a.created_timestamp - b.created_timestamp);
      for (const tweet of fresh) {
        found.push({
          projectId: project.id,
          username: project.username,
          tweet,
        });
      }
    } catch (err) {
      log(`@${project.username} poll failed`, err);
    }
  }

  return found;
}
