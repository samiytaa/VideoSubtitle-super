import { accessSync, constants as fsConstants, existsSync } from "node:fs";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";

import ffmpegPath from "ffmpeg-static";
import { runtimePaths } from "../runtime-paths.js";

const DEFAULT_CONCURRENCY = 6;
const MAX_CONCURRENCY = 16;
// 单次 ffmpeg 调用最多处理的帧数（multi-seek 模式）
// 增加批次大小可以减少 ffmpeg 进程启动次数，提高整体速度
const MULTI_SEEK_BATCH_SIZE = 16;
let cachedBinaryPath = null;

function assertReadableFile(filePath, label) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error(`${label} is required`);
  }
  accessSync(filePath, fsConstants.R_OK);
}

function getFfmpegCandidates() {
  const candidates = [];

  if (typeof process.env.FFMPEG_PATH === "string" && process.env.FFMPEG_PATH.trim()) {
    candidates.push(process.env.FFMPEG_PATH.trim());
  }

  if (typeof ffmpegPath === "string" && ffmpegPath.trim()) {
    candidates.push(ffmpegPath.trim());
  }

  const bundledBinary = process.platform === "win32"
    ? `${runtimePaths.baseDirectory}\\node_modules\\ffmpeg-static\\ffmpeg.exe`
    : `${runtimePaths.baseDirectory}/node_modules/ffmpeg-static/ffmpeg`;
  candidates.push(bundledBinary);

  try {
    const whereInPath = spawnSync("where", ["ffmpeg"], {
      windowsHide: true,
      encoding: "utf8",
      timeout: 5000
    });
    if (whereInPath.status === 0 && whereInPath.stdout) {
      candidates.push(...whereInPath.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean));
    }
  } catch {
    // ignore
  }

  if (process.platform === "win32") {
    const recursiveRoots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA]
      .filter((item) => typeof item === "string" && item.trim());

    for (const root of recursiveRoots) {
      try {
        const probe = spawnSync("where", ["/r", root, "ffmpeg.exe"], {
          windowsHide: true,
          encoding: "utf8",
          timeout: 8000,
          maxBuffer: 1024 * 1024
        });
        if (probe.status === 0 && probe.stdout) {
          candidates.push(...probe.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean));
        }
      } catch {
        // ignore
      }
    }
  }

  return [...new Set(candidates.filter(Boolean))];
}

function resolveFfmpegBinary() {
  if (cachedBinaryPath) return cachedBinaryPath;

  for (const candidate of getFfmpegCandidates()) {
    if (!existsSync(candidate)) continue;
    try {
      assertReadableFile(candidate, "ffmpeg binary");
      const probe = spawnSync(candidate, ["-version"], {
        windowsHide: true,
        encoding: "utf8",
        timeout: 5000
      });
      if (probe.status !== 0 || probe.error) {
        continue;
      }
      cachedBinaryPath = candidate;
      return cachedBinaryPath;
    } catch {
      // try next candidate
    }
  }

  throw new Error("No usable ffmpeg binary found. Set FFMPEG_PATH or reinstall ffmpeg-static.");
}

function normalizeCrop(crop) {
  const x = Math.max(0, Math.round(Number(crop?.x) || 0));
  const y = Math.max(0, Math.round(Number(crop?.y) || 0));
  const width = Math.max(1, Math.round(Number(crop?.width) || 0));
  const height = Math.max(1, Math.round(Number(crop?.height) || 0));
  return { x, y, width, height };
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("tasks is required");
  }

  return tasks.map((task, index) => ({
    taskId: Number.isFinite(task?.taskId) ? task.taskId : index,
    requestedTime: Math.max(0, Number(task?.requestedTime) || 0)
  }));
}

function resolveMimeType(format) {
  switch (format) {
    case "png":
      return "image/png";
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    default:
      return "image/webp";
  }
}

function resolveCodec(format) {
  switch (format) {
    case "png":
      return "png";
    case "jpeg":
    case "jpg":
      return "mjpeg";
    default:
      return "libwebp";
  }
}

function runFfmpegFrame({ ffmpegBinary, videoPath, crop, format, quality, requestedTime }) {
  return new Promise((resolve, reject) => {
    const codec = resolveCodec(format);
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      requestedTime.toFixed(3),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
      "-c:v",
      codec
    ];

    if (format === "webp") {
      args.push("-quality", String(Math.max(1, Math.min(100, quality))));
      args.push("-compression_level", "4");
    } else if (format === "jpeg" || format === "jpg") {
      const qValue = Math.max(2, Math.min(31, Math.round(31 - ((Math.max(1, Math.min(100, quality)) - 1) / 99) * 29)));
      args.push("-q:v", String(qValue));
    }

    args.push("-f", "image2pipe", "pipe:1");

    const child = spawn(ffmpegBinary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderrChunks).toString("utf8").trim() || `ffmpeg exited with code ${code}`));
        return;
      }

      const buffer = Buffer.concat(stdoutChunks);
      if (!buffer.length) {
        reject(new Error("ffmpeg produced empty frame output"));
        return;
      }

      resolve(buffer);
    });
  });
}

/**
 * 单次 ffmpeg 调用提取一批帧（concat demuxer + 临时文件输出）。
 * 相比每帧独立 spawn，减少进程启动开销，速度提升显著。
 * @param {object} opts
 * @param {string} opts.ffmpegBinary
 * @param {string} opts.videoPath
 * @param {object} opts.crop
 * @param {number} opts.quality  1-100
 * @param {Array<{taskId:number, requestedTime:number}>} opts.tasks
 * @returns {Promise<Array<{taskId:number, requestedTime:number, buffer:Buffer}>>}
 */
async function runFfmpegMultiFrame({ ffmpegBinary, videoPath, crop, quality, tasks }) {
  if (tasks.length === 0) return [];
  if (tasks.length === 1) {
    // 单帧直接走原有路径，避免 concat 开销
    const buf = await runFfmpegFrame({
      ffmpegBinary,
      videoPath,
      crop,
      format: "png",
      quality,
      requestedTime: tasks[0].requestedTime,
    });
    return [{ taskId: tasks[0].taskId, requestedTime: tasks[0].requestedTime, buffer: buf }];
  }

  // 构造 concat list 临时文件，并将每帧输出到临时目录中的独立文件
  const tmpDir = await mkdtemp(join(tmpdir(), "vss-"));
  const listPath = join(tmpDir, "list.txt");

  try {
    // ffconcat 格式：每个 entry 精确 seek 到目标时间，duration 0.04s 确保能取到帧
    const lines = ["ffconcat version 1.0"];
    for (const task of tasks) {
      // Windows 路径转正斜杠，单引号转义
      const safePath = videoPath.replace(/\\/g, "/").replace(/'/g, "\\'");
      lines.push(`file '${safePath}'`);
      lines.push(`inpoint ${task.requestedTime.toFixed(6)}`);
      lines.push(`duration 0.04`); // 减少 duration 以加快处理
    }
    await writeFile(listPath, lines.join("\n"), "utf8");

    const cropFilter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;
    // 输出到临时目录，每帧一个 PNG 文件，用 %d 序号命名
    const outputPattern = join(tmpDir, "frame%d.png");

    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-vf",
      // 使用 select 过滤器只取每段第一帧，提高效率
      `${cropFilter},select='eq(n\\,0)',setpts=N/TB`,
      "-vsync",
      "0", // 禁用帧率同步，加快处理
      "-frames:v",
      String(tasks.length),
      "-c:v",
      "png",
      "-compression_level",
      "0", // PNG 不压缩，加快编码速度
      outputPattern,
    ];

    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegBinary, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      const stderrChunks = [];
      child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              Buffer.concat(stderrChunks).toString("utf8").trim() ||
                `ffmpeg multi-frame exited with code ${code}`
            )
          );
          return;
        }
        resolve();
      });
    });

    // 读取输出文件（frame1.png, frame2.png, ...）
    return await Promise.all(
      tasks.map(async (task, i) => {
        const filePath = join(tmpDir, `frame${i + 1}.png`);
        try {
          const buffer = await readFile(filePath);
          return { taskId: task.taskId, requestedTime: task.requestedTime, buffer };
        } catch {
          return { taskId: task.taskId, requestedTime: task.requestedTime, buffer: null };
        }
      })
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function extractFramesWithFfmpeg(payload) {
  const ffmpegBinary = resolveFfmpegBinary();
  assertReadableFile(payload?.videoPath, "videoPath");
  assertReadableFile(ffmpegBinary, "ffmpeg binary");

  const crop = normalizeCrop(payload?.crop);
  const tasks = normalizeTasks(payload?.tasks);
  const format = payload?.format === "png" || payload?.format === "jpeg" || payload?.format === "jpg" ? payload.format : "webp";
  const quality = Math.max(1, Math.min(100, Math.round(Number(payload?.quality) || 82)));
  const concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, Math.round(Number(payload?.concurrency) || DEFAULT_CONCURRENCY)));
  const mimeType = resolveMimeType(format);

  // 使用批量处理模式：将任务分成多个批次，每批使用单次 ffmpeg 调用处理多帧
  const batches = [];
  for (let i = 0; i < tasks.length; i += MULTI_SEEK_BATCH_SIZE) {
    batches.push(tasks.slice(i, i + MULTI_SEEK_BATCH_SIZE));
  }

  const allResults = await runPool(batches, concurrency, async (batch) => {
    try {
      const batchResults = await runFfmpegMultiFrame({
        ffmpegBinary,
        videoPath: payload.videoPath,
        crop,
        quality,
        tasks: batch,
      });
      
      // 转换为最终格式
      return batchResults.map((item) => {
        if (!item.buffer) return null;
        return {
          taskId: item.taskId,
          requestedTime: item.requestedTime,
          capturedTime: item.requestedTime,
          url: `data:image/png;base64,${item.buffer.toString("base64")}`,
        };
      });
    } catch {
      return batch.map(() => null);
    }
  });

  const results = allResults.flat().filter(Boolean);

  return {
    ok: true,
    ffmpegBinary,
    format: "png", // 批量模式固定使用 PNG
    quality,
    count: results.length,
    results,
  };
}
