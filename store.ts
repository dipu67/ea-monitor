import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "./config.js";

export interface Project {
  id: string;
  username: string;
  name: string;
  bio: string;
  cursor?: string;
  mintDate?: string;
  createdAt: string;
}

export interface Subscriber {
  chatId: string;
  username: string | null;
  createdAt: string;
}

export interface AppSettings {
  pollIntervalSec: number;
  paused: boolean;
  includeReplies: boolean;
}

interface StoreData {
  projects: Project[];
  subscribers: Subscriber[];
  settings: AppSettings;
}

function emptyStore(): StoreData {
  return {
    projects: [],
    subscribers: [],
    settings: {
      pollIntervalSec: config.defaultPollIntervalSec,
      paused: false,
      includeReplies: false,
    },
  };
}

let cache: StoreData | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function persist(data: StoreData) {
  const file = config.storePath;
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

async function load(): Promise<StoreData> {
  if (cache) return cache;
  const file = config.storePath;
  if (!existsSync(file)) {
    cache = emptyStore();
    await persist(cache);
    return cache;
  }
  const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<StoreData>;
  cache = {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers : [],
    settings: { ...emptyStore().settings, ...parsed.settings },
  };
  return cache;
}

function mutate<T>(fn: (data: StoreData) => T): Promise<T> {
  const run = async () => {
    const data = await load();
    const result = fn(data);
    await persist(data);
    return result;
  };
  const next = writeChain.then(run, run);
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function getSettings(): Promise<AppSettings> {
  const data = await load();
  return data.settings;
}

export function updateSettings(patch: Partial<AppSettings>) {
  return mutate((data) => {
    data.settings = { ...data.settings, ...patch };
    return data.settings;
  });
}

export async function listProjects(): Promise<Project[]> {
  const data = await load();
  return [...data.projects].sort((a, b) => a.username.localeCompare(b.username));
}

export async function findProjectByUsername(username: string) {
  const data = await load();
  const key = username.toLowerCase();
  return data.projects.find((p) => p.username.toLowerCase() === key) ?? null;
}

export function createProject(input: {
  id: string;
  name: string;
  username: string;
  bio: string;
  cursor?: string;
}) {
  return mutate((data) => {
    const key = input.username.toLowerCase();
    if (data.projects.some((p) => p.username.toLowerCase() === key)) {
      throw new Error(`Already watching @${input.username}`);
    }
    const project: Project = {
      id: input.id,
      username: input.username,
      name: input.name,
      bio: input.bio,
      createdAt: new Date().toISOString(),
    };
    if (input.cursor) project.cursor = input.cursor;
    data.projects.push(project);
    return project;
  });
}

export function updateProject(
  where: { id?: string; username?: string },
  patch: Partial<Pick<Project, "cursor" | "mintDate" | "name" | "bio">>,
) {
  return mutate((data) => {
    const project = data.projects.find((p) => {
      if (where.id) return p.id === where.id;
      if (where.username) return p.username.toLowerCase() === where.username.toLowerCase();
      return false;
    });
    if (!project) return null;
    if (patch.cursor !== undefined) project.cursor = patch.cursor;
    if (patch.mintDate !== undefined) project.mintDate = patch.mintDate;
    if (patch.name !== undefined) project.name = patch.name;
    if (patch.bio !== undefined) project.bio = patch.bio;
    return project;
  });
}

export function deleteProject(username: string) {
  return mutate((data) => {
    const key = username.toLowerCase();
    const index = data.projects.findIndex((p) => p.username.toLowerCase() === key);
    if (index < 0) return null;
    const [removed] = data.projects.splice(index, 1);
    return removed ?? null;
  });
}

export async function countProjects() {
  const data = await load();
  return data.projects.length;
}

export function upsertSubscriber(chatId: string, username: string | null) {
  return mutate((data) => {
    const existing = data.subscribers.find((s) => s.chatId === chatId);
    if (existing) {
      existing.username = username;
      return existing;
    }
    const created: Subscriber = {
      chatId,
      username,
      createdAt: new Date().toISOString(),
    };
    data.subscribers.push(created);
    return created;
  });
}

export async function listSubscribers() {
  const data = await load();
  return data.subscribers;
}
