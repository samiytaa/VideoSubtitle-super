#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
头像下载与映射生成器

默认流程：
1. 从代号鸢 wiki 下载头像到 img/小头像
2. 扫描 img/小头像 目录，生成头像名称到文件路径的映射

兼容用法：
- 只生成映射：python scripts/generate_avatar_map.py --skip-download
- 下载后生成：python scripts/generate_avatar_map.py
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_AVATAR_DIR = REPO_ROOT / "img" / "小头像"
DEFAULT_OUTPUT_FILE = REPO_ROOT / "utils" / "avatarMap.ts"
DOWNLOAD_SCRIPT = SCRIPT_DIR / "download_wiki_avatars.py"
MANIFEST_NAME = "_wiki_download_manifest.json"
LEAD_NAMES = ["刘辩", "傅融", "袁基", "左慈", "孙策"]
ROOT_CATEGORY_ORDER = ["其他小头像汇总", "心纸君汇总", "绒绒版汇总", "QQ人汇总", "离魂汇总"]
GUANGLING_ROOT_NAME = "广陵王头像"
LEAD_ROOT_NAME = "男主头像"
LEGACY_AVATAR_PREFIX = "小头像-"


def normalize_avatar_name(avatar_name: str) -> str:
    if avatar_name.startswith(LEGACY_AVATAR_PREFIX):
        return avatar_name[len(LEGACY_AVATAR_PREFIX):]
    return avatar_name


def should_replace_avatar_path(current_path: str, candidate_path: str) -> bool:
    current_name = PurePosixPath(current_path).name
    candidate_name = PurePosixPath(candidate_path).name

    current_score = (
        0 if current_name.startswith(LEGACY_AVATAR_PREFIX) else 1,
        0 if current_path.startswith("其他小头像汇总/") else 1,
        -len(current_path),
    )
    candidate_score = (
        0 if candidate_name.startswith(LEGACY_AVATAR_PREFIX) else 1,
        0 if candidate_path.startswith("其他小头像汇总/") else 1,
        -len(candidate_path),
    )
    return candidate_score > current_score


def get_path_parts(path: str) -> tuple[str, ...]:
    return PurePosixPath(path).parts


def get_lead_name(avatar_name: str, path: str) -> str | None:
    path_parts = get_path_parts(path)
    for lead in LEAD_NAMES:
        if lead in avatar_name or any(lead in part for part in path_parts):
            return lead
    if "王子乔" in avatar_name or any("王子乔" in part for part in path_parts):
        return "左慈"
    return None


def is_guangling_avatar(avatar_name: str, path: str) -> bool:
    path_parts = get_path_parts(path)
    if path.startswith("广陵王小头像汇总/"):
        return True
    if path.startswith("离魂汇总/广陵王离魂/"):
        return True
    if "广陵王QQ人" in path:
        return True
    if any("广陵王" in part for part in path_parts):
        return True

    return (
        "广陵王" in avatar_name
        or avatar_name.startswith("世子常服-")
        or avatar_name.startswith("宗室常服-")
        or avatar_name.startswith("江东乔影-")
        or avatar_name.startswith("内廷绣罗-")
        or avatar_name.startswith("逆波上流-")
        or avatar_name.startswith("巫女-")
        or avatar_name.startswith("随侯明月-")
    )


def trim_lead_segments(path_parts: tuple[str, ...], lead_name: str) -> list[str]:
    trimmed = list(path_parts[:-1])
    return [part for part in trimmed if part != lead_name and lead_name not in part]


def trim_guangling_segments(path_parts: tuple[str, ...]) -> list[str]:
    trimmed = list(path_parts[:-1])
    skip_prefixes = ("广陵王", "狐虎度假游·广陵王")
    filtered = [part for part in trimmed if not any(part.startswith(prefix) for prefix in skip_prefixes)]
    if len(path_parts) >= 3 and path_parts[1] == "广陵王" and filtered:
        filtered[0] = f"广陵王-{filtered[0]}"
    return filtered


def normalize_manifest_path(base_dir: Path, manifest_path: str) -> str:
    posix_base = PurePosixPath(base_dir.as_posix())
    posix_path = PurePosixPath(manifest_path)
    try:
        return str(posix_path.relative_to(posix_base)).replace("/", "/")
    except ValueError:
        return posix_path.name if len(posix_path.parts) == 1 else posix_path.as_posix()


def load_manifest_order(base_dir: Path) -> dict[str, dict[str, Any]]:
    manifest_path = base_dir / MANIFEST_NAME
    if not manifest_path.exists():
        return {}

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    categories = payload.get("categories")
    if not isinstance(categories, dict):
        return {}

    manifest_order: dict[str, dict[str, Any]] = {}
    for category_index, (category_name, entries) in enumerate(categories.items()):
        if not isinstance(entries, list):
            continue
        for fallback_entry_index, entry in enumerate(entries, start=1):
            if not isinstance(entry, dict):
                continue
            raw_path = entry.get("path")
            if not isinstance(raw_path, str) or not raw_path:
                continue
            relative_path = normalize_manifest_path(base_dir, raw_path)
            manifest_order[relative_path] = {
                "category": category_name,
                "category_index": category_index,
                "page_title": entry.get("page_title", ""),
                "section": entry.get("section", ""),
                "section_parts": entry.get("section_parts", []),
                "heading_order_path": entry.get("heading_order_path", []),
                "entry_order": int(entry.get("entry_order", fallback_entry_index)),
            }
    return manifest_order


def build_avatar_records(base_dir: Path, manifest_order: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    supported_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    records: list[dict[str, Any]] = []

    for root, _, files in os.walk(base_dir):
        for file in files:
            file_path = Path(file)
            if file_path.suffix.lower() not in supported_extensions:
                continue

            full_path = Path(root) / file
            relative_path = full_path.relative_to(base_dir).as_posix()
            records.append(
                {
                    "name": normalize_avatar_name(file_path.stem),
                    "path": relative_path,
                    "manifest": manifest_order.get(relative_path),
                }
            )

    def sort_key(record: dict[str, Any]) -> tuple[int, int, int, str]:
        manifest_meta = record.get("manifest")
        if manifest_meta:
            return (
                0,
                int(manifest_meta.get("category_index", 0)),
                int(manifest_meta.get("entry_order", 0)),
                record["path"],
            )
        return (1, 0, 0, record["path"])

    records.sort(key=sort_key)
    return records


def add_avatar_to_group(group_map: dict[str, Any], avatar_name: str, group_parts: list[str]) -> None:
    group_map.setdefault("avatars", []).append(avatar_name)
    if not group_parts:
        return

    subcategories = group_map.setdefault("subcategories", {})
    sub_name = group_parts[0]
    sub_group = subcategories.setdefault(sub_name, {"avatars": []})
    sub_group["avatars"].append(avatar_name)

    if len(group_parts) > 1:
        leaf_name = "/".join(group_parts[1:])
        leaf_subcategories = sub_group.setdefault("subcategories", {})
        leaf_group = leaf_subcategories.setdefault(leaf_name, {"avatars": []})
        leaf_group["avatars"].append(avatar_name)


def serialize_group(name: str, group: dict[str, Any]) -> dict[str, Any]:
    result = {
        "name": name,
        "avatars": list(group.get("avatars", [])),
    }

    raw_subcategories = group.get("subcategories", {})
    if raw_subcategories:
        serialized_subcategories = []
        for sub_name, sub_group in raw_subcategories.items():
            sub_result = {
                "name": sub_name,
                "avatars": list(sub_group.get("avatars", [])),
            }
            raw_leaf_subcategories = sub_group.get("subcategories", {})
            if raw_leaf_subcategories:
                sub_result["subcategories"] = [
                    {
                        "name": leaf_name,
                        "avatars": list(raw_leaf_subcategories[leaf_name].get("avatars", [])),
                    }
                    for leaf_name in raw_leaf_subcategories
                ]
            serialized_subcategories.append(sub_result)
        result["subcategories"] = serialized_subcategories

    return result


def build_avatar_categories(avatar_map: dict[str, str]) -> list[dict[str, Any]]:
    generic_groups: dict[str, dict[str, Any]] = {}
    guangling_group: dict[str, Any] = {"avatars": [], "subcategories": {}}
    lead_groups: dict[str, dict[str, Any]] = {}

    for avatar_name, path in avatar_map.items():
        path_parts = get_path_parts(path)

        if is_guangling_avatar(avatar_name, path):
            trimmed_parts = trim_guangling_segments(path_parts)
            add_avatar_to_group(guangling_group, avatar_name, trimmed_parts)
            continue

        lead_name = get_lead_name(avatar_name, path)
        if lead_name:
            trimmed_parts = trim_lead_segments(path_parts, lead_name)
            add_avatar_to_group(lead_groups.setdefault(lead_name, {"avatars": [], "subcategories": {}}), avatar_name, trimmed_parts)
            continue

        root_name = path_parts[0]
        remaining_parts = list(path_parts[1:-1])
        add_avatar_to_group(generic_groups.setdefault(root_name, {"avatars": [], "subcategories": {}}), avatar_name, remaining_parts)

    result: list[dict[str, Any]] = []

    if guangling_group["avatars"]:
        result.append(serialize_group(GUANGLING_ROOT_NAME, guangling_group))

    lead_subcategories = [serialize_group(lead_name, lead_groups[lead_name]) for lead_name in lead_groups]
    if lead_subcategories:
        result.append(
            {
                "name": LEAD_ROOT_NAME,
                "avatars": [avatar for subcategory in lead_subcategories for avatar in subcategory["avatars"]],
                "subcategories": lead_subcategories,
            }
        )

    ordered_generic_roots = [name for name in ROOT_CATEGORY_ORDER if name in generic_groups]
    ordered_generic_roots.extend(name for name in generic_groups if name not in ROOT_CATEGORY_ORDER)
    for root_name in ordered_generic_roots:
        result.append(serialize_group(root_name, generic_groups[root_name]))

    return result


def run_wiki_download(
    output_dir: Path,
    categories: list[str] | None,
    force: bool,
    limit: int,
    sleep: float,
    use_env_proxy: bool,
) -> None:
    """调用 wiki 下载脚本。"""
    script_path = Path(__file__).resolve().parent / DOWNLOAD_SCRIPT
    if not script_path.exists():
        raise FileNotFoundError(f"下载脚本不存在: {script_path}")

    command = [
        sys.executable,
        str(script_path),
        "--output",
        str(output_dir),
        "--sleep",
        str(sleep),
    ]

    if force:
        command.append("--force")
    if limit > 0:
        command.extend(["--limit", str(limit)])
    if use_env_proxy:
        command.append("--use-env-proxy")
    for category in categories or []:
        command.extend(["--category", category])

    print("开始下载 wiki 头像...", flush=True)
    print(f"执行命令: {' '.join(command)}", flush=True)
    subprocess.run(command, check=True)


def generate_avatar_map(base_dir: str | Path = DEFAULT_AVATAR_DIR, output_file: str | Path = DEFAULT_OUTPUT_FILE) -> None:
    """
    扫描指定目录，生成头像映射。

    Args:
        base_dir: 头像目录的基础路径
        output_file: 输出文件路径
    """
    base_dir = Path(base_dir)
    output_file = Path(output_file)

    if not base_dir.exists():
        print(f"错误: 目录 '{base_dir}' 不存在")
        return

    manifest_order = load_manifest_order(base_dir)
    avatar_records = build_avatar_records(base_dir, manifest_order)

    avatar_map: dict[str, str] = {}
    for record in avatar_records:
        if record["name"] in avatar_map and avatar_map[record["name"]] != record["path"]:
            if should_replace_avatar_path(avatar_map[record["name"]], record["path"]):
                avatar_map[record["name"]] = record["path"]
            continue
        avatar_map[record["name"]] = record["path"]

    avatar_categories = build_avatar_categories(avatar_map)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8") as file_obj:
        file_obj.write("// 头像路径映射表\n")
        file_obj.write("// 自动生成，请勿手动编辑\n")
        file_obj.write("// 生成命令: python scripts/generate_avatar_map.py\n\n")
        file_obj.write("import { logger } from './logger';\n\n")
        file_obj.write("const LOCAL_AVATAR_ROOT = '小头像';\n\n")
        file_obj.write("const LEGACY_AVATAR_PREFIX = '小头像-';\n\n")
        file_obj.write("export const avatarMap: { [key: string]: string } = {\n")

        items = list(avatar_map.items())
        for index, (name, path) in enumerate(items):
            comma = "," if index < len(items) - 1 else ""
            file_obj.write(f"  {json.dumps(name, ensure_ascii=False)}: {json.dumps(path, ensure_ascii=False)}{comma}\n")

        file_obj.write("};\n\n")
        file_obj.write("export const avatarCategories = ")
        file_obj.write(json.dumps(avatar_categories, ensure_ascii=False, indent=2))
        file_obj.write(" as const;\n\n")
        file_obj.write("export const normalizeAvatarName = (avatarName: string): string => {\n")
        file_obj.write("  if (!avatarName) return '';\n")
        file_obj.write("  return avatarName.startsWith(LEGACY_AVATAR_PREFIX)\n")
        file_obj.write("    ? avatarName.slice(LEGACY_AVATAR_PREFIX.length)\n")
        file_obj.write("    : avatarName;\n")
        file_obj.write("};\n\n")
        file_obj.write("export const resolveAvatarName = (avatarName: string): string | null => {\n")
        file_obj.write("  if (!avatarName) return null;\n\n")
        file_obj.write("  const normalizedName = normalizeAvatarName(avatarName);\n")
        file_obj.write("  if (avatarMap[normalizedName]) return normalizedName;\n")
        file_obj.write("  if (avatarMap[avatarName]) return avatarName;\n")
        file_obj.write("  return null;\n")
        file_obj.write("};\n\n")
        file_obj.write("/**\n")
        file_obj.write(" * 获取头像的完整路径\n")
        file_obj.write(" * @param avatarName 头像名称\n")
        file_obj.write(" * @returns 完整的图片路径，如果未找到则返回 null\n")
        file_obj.write(" */\n")
        file_obj.write("export const getAvatarPath = (avatarName: string): string | null => {\n")
        file_obj.write("  if (!avatarName) return null;\n\n")
        file_obj.write("  const resolvedAvatarName = resolveAvatarName(avatarName);\n")
        file_obj.write("  const relativePath = resolvedAvatarName ? avatarMap[resolvedAvatarName] : undefined;\n")
        file_obj.write("  if (!relativePath) {\n")
        file_obj.write("    logger.warn(`未找到头像映射: ${avatarName}`);\n")
        file_obj.write("    return null;\n")
        file_obj.write("  }\n\n")
        file_obj.write("  const normalizedPath = `${LOCAL_AVATAR_ROOT}/${relativePath}`;\n")
        file_obj.write("  return `${import.meta.env.BASE_URL}${encodeURI(normalizedPath)}`;\n")
        file_obj.write("};\n\n")
        file_obj.write("/**\n")
        file_obj.write(" * 获取所有可用的头像名称列表\n")
        file_obj.write(" * @returns 头像名称数组\n")
        file_obj.write(" */\n")
        file_obj.write("export const getAvailableAvatars = (): string[] => {\n")
        file_obj.write("  return Object.keys(avatarMap);\n")
        file_obj.write("};\n\n")
        file_obj.write("const normalizeAvatarLookupText = (value: string): string => {\n")
        file_obj.write("  return normalizeAvatarName(value)\n")
        file_obj.write("    .trim()\n")
        file_obj.write("    .replace(/[·•・]/g, '')\n")
        file_obj.write("    .replace(/\\s+/g, '')\n")
        file_obj.write("    .replace(/[()（）\\[\\]【】]/g, '');\n")
        file_obj.write("};\n\n")
        file_obj.write("const buildAvatarMatchScore = (characterName: string, avatarName: string, avatarPath: string): number => {\n")
        file_obj.write("  const normalizedCharacter = normalizeAvatarLookupText(characterName);\n")
        file_obj.write("  const normalizedAvatar = normalizeAvatarLookupText(avatarName);\n\n")
        file_obj.write("  if (!normalizedCharacter || !normalizedAvatar.includes(normalizedCharacter)) {\n")
        file_obj.write("    return Number.NEGATIVE_INFINITY;\n")
        file_obj.write("  }\n\n")
        file_obj.write("  let score = 0;\n\n")
        file_obj.write("  if (avatarName === characterName) score += 2000;\n")
        file_obj.write("  if (avatarName.startsWith(`${characterName}-`)) score += 1500;\n")
        file_obj.write("  if (avatarName.endsWith(`·${characterName}`)) score += 500;\n")
        file_obj.write("  if (normalizedAvatar === normalizedCharacter) score += 1200;\n\n")
        file_obj.write("  if (avatarPath.includes('小头像-')) score += 300;\n")
        file_obj.write("  if (avatarName.includes('默认')) score += 120;\n")
        file_obj.write("  if (avatarName.includes('正常')) score += 120;\n")
        file_obj.write("  if (avatarName.includes('微笑')) score += 80;\n\n")
        file_obj.write("  if (avatarName.includes('q版') || avatarName.includes('QQ人')) score -= 220;\n")
        file_obj.write("  if (avatarName.includes('离魂')) score -= 260;\n")
        file_obj.write("  if (avatarName.includes('心纸君')) score -= 180;\n")
        file_obj.write("  if (avatarName.includes('猫绒绒') || avatarName.includes('狗绒绒')) score -= 160;\n\n")
        file_obj.write("  score -= avatarName.length * 0.5;\n")
        file_obj.write("  return score;\n")
        file_obj.write("};\n\n")
        file_obj.write("/**\n")
        file_obj.write(" * 根据角色名自动查找最合适的头像\n")
        file_obj.write(" * 优先普通小头像，其次默认/常规表情头像，再退化到其他变体\n")
        file_obj.write(" */\n")
        file_obj.write("export const findBestAvatarMatch = (characterName: string): string | null => {\n")
        file_obj.write("  if (!characterName?.trim()) return null;\n\n")
        file_obj.write("  let bestAvatar: string | null = null;\n")
        file_obj.write("  let bestScore = Number.NEGATIVE_INFINITY;\n\n")
        file_obj.write("  for (const [avatarName, avatarPath] of Object.entries(avatarMap)) {\n")
        file_obj.write("    const score = buildAvatarMatchScore(characterName, avatarName, avatarPath);\n")
        file_obj.write("    if (score > bestScore) {\n")
        file_obj.write("      bestScore = score;\n")
        file_obj.write("      bestAvatar = avatarName;\n")
        file_obj.write("    }\n")
        file_obj.write("  }\n\n")
        file_obj.write("  return Number.isFinite(bestScore) ? bestAvatar : null;\n")
        file_obj.write("};\n")

    json_output = output_file.with_suffix(".json")
    with json_output.open("w", encoding="utf-8") as file_obj:
        json.dump(avatar_map, file_obj, ensure_ascii=False, indent=2)

    categories_json_output = output_file.with_name(f"{output_file.stem}.categories.json")
    with categories_json_output.open("w", encoding="utf-8") as file_obj:
        json.dump(avatar_categories, file_obj, ensure_ascii=False, indent=2)

    print("成功生成头像映射")
    print(f"  - 找到 {len(avatar_map)} 个头像文件")
    print(f"  - TypeScript 映射: {output_file}")
    print(f"  - JSON 映射: {json_output}")
    print(f"  - 菜单分类 JSON: {categories_json_output}")
    print("\n前5个映射示例:")
    for name, path in list(avatar_map.items())[:5]:
        print(f"  '{name}' -> '{path}'")

    if len(avatar_map) > 5:
        print(f"  ... 还有 {len(avatar_map) - 5} 个")


def main() -> None:
    parser = argparse.ArgumentParser(description="下载 wiki 头像并生成头像映射文件")
    parser.add_argument(
        "--dir",
        default=str(DEFAULT_AVATAR_DIR),
        help=f"头像目录路径 (默认: {DEFAULT_AVATAR_DIR})",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_FILE),
        help=f"输出文件路径 (默认: {DEFAULT_OUTPUT_FILE})",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="跳过 wiki 下载，仅基于本地目录生成映射",
    )
    parser.add_argument(
        "--category",
        action="append",
        help="限制下载分类，可重复传入；默认下载脚本内的全部目标分类",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="下载时覆盖已存在文件",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="每个分类最多下载多少张，0 表示不限制",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.15,
        help="下载时每张图之间的暂停秒数，默认 0.15",
    )
    parser.add_argument(
        "--use-env-proxy",
        action="store_true",
        help="下载时使用系统代理；默认忽略系统代理",
    )

    args = parser.parse_args()

    avatar_dir = Path(args.dir)
    output_file = Path(args.output)

    if not args.skip_download:
        run_wiki_download(
            output_dir=avatar_dir,
            categories=args.category,
            force=args.force_download,
            limit=args.limit,
            sleep=args.sleep,
            use_env_proxy=args.use_env_proxy,
        )

    generate_avatar_map(avatar_dir, output_file)


if __name__ == "__main__":
    main()
