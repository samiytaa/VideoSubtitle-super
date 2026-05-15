#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从代号鸢 wiki 批量下载头像资源。

默认只下载截图红框中的 6 个分类：
- 心纸君汇总
- 广陵王小头像汇总
- 其他小头像汇总
- QQ人汇总
- 离魂汇总
- 绒绒版汇总

用法示例：
  python scripts/download_wiki_avatars.py
  python scripts/download_wiki_avatars.py --output img/小头像 --limit 10
  python scripts/download_wiki_avatars.py --force
"""

from __future__ import annotations

import argparse
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse, unquote

import requests
from bs4 import BeautifulSoup


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
ROOT_URL = "https://wiki.biligame.com"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "img" / "小头像"
MANIFEST_NAME = "_wiki_download_manifest.json"

TARGET_CATEGORIES = {
    "心纸君汇总": "https://wiki.biligame.com/yuan/%E5%BF%83%E7%BA%B8%E5%90%9B%E6%B1%87%E6%80%BB",
    "广陵王小头像汇总": "https://wiki.biligame.com/yuan/%E5%B0%8F%E5%A4%B4%E5%83%8F%E6%B1%87%E6%80%BB",
    "其他小头像汇总": "https://wiki.biligame.com/yuan/%E5%B0%8F%E5%A4%B4%E5%83%8F%E6%B1%87%E6%80%BB02",
    "QQ人汇总": "https://wiki.biligame.com/yuan/%E5%B0%8F%E5%A4%B4%E5%83%8F%E6%B1%87%E6%80%BB04",
    "离魂汇总": "https://wiki.biligame.com/yuan/%E5%B0%8F%E5%A4%B4%E5%83%8F%E6%B1%87%E6%80%BB05",
    "绒绒版汇总": "https://wiki.biligame.com/yuan/%E5%B0%8F%E5%A4%B4%E5%83%8F%E6%B1%87%E6%80%BB08",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)
DEFAULT_MAX_WORKERS = 8


_thread_local = threading.local()


@dataclass(frozen=True)
class ImageEntry:
    category: str
    title: str
    image_url: str
    source_page: str
    page_title: str
    section: str | None = None  # 页面内标题层级目录，如 "男主/刘辩" 或 "密探/密探-三国志绒绒版/猫绒绒"
    section_parts: tuple[str, ...] = ()
    heading_order_path: tuple[int, ...] = ()
    entry_order: int = 0


def build_session(use_env_proxy: bool) -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://wiki.biligame.com/yuan/",
        "Origin": "https://wiki.biligame.com",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    })
    session.trust_env = use_env_proxy
    return session


def get_thread_session(use_env_proxy: bool) -> requests.Session:
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = build_session(use_env_proxy=use_env_proxy)
        _thread_local.session = session
    return session


def fetch_soup(session: requests.Session, url: str, retries: int = 3) -> BeautifulSoup:
    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, timeout=30)
            if response.status_code == 567:
                # wiki 反爬限流，等待后重试
                wait = attempt * 3
                print(f"    [警告] 收到 567，等待 {wait}s 后重试 ({attempt}/{retries})…")
                time.sleep(wait)
                continue
            response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except requests.exceptions.HTTPError as exc:
            last_exc = exc
            if attempt < retries:
                wait = attempt * 3
                print(f"    [警告] HTTP 错误 {exc}，等待 {wait}s 后重试 ({attempt}/{retries})…")
                time.sleep(wait)
            else:
                raise
    raise last_exc  # type: ignore[misc]


def sanitize_name(name: str) -> str:
    name = re.sub(r"[\\/:*?\"<>|]", "_", name.strip())
    return name.rstrip(". ") or "unnamed"


def infer_extension_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    suffix = Path(path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        return suffix
    return ".png"


def title_from_file_page_url(file_page_url: str) -> str:
    path = unquote(urlparse(file_page_url).path)
    title = path.rsplit("/", 1)[-1]
    if title.startswith("文件:"):
        title = title[3:]
    return sanitize_name(Path(title).stem)


def original_from_thumb(url: str) -> str:
    if "/thumb/" not in url:
        return url

    prefix, suffix = url.split("/thumb/", 1)
    parts = suffix.split("/")
    if len(parts) < 4:
        return url
    return f"{prefix}/{parts[0]}/{parts[1]}/{parts[2]}"


def extract_original_from_srcset(srcset: str) -> str | None:
    for item in [part.strip() for part in srcset.split(",") if part.strip()]:
        pieces = item.split()
        if not pieces:
            continue
        candidate = pieces[0]
        if "/images/yuan/" in candidate:
            return original_from_thumb(candidate)
    return None


def _get_heading_level(tag_name: str | None) -> int | None:
    if not tag_name or len(tag_name) != 2 or tag_name[0] != "h" or not tag_name[1].isdigit():
        return None
    level = int(tag_name[1])
    if 1 <= level <= 6:
        return level
    return None


def _update_heading_stack(heading_stack: dict[int, str], level: int, text: str) -> None:
    heading_stack[level] = text
    for deeper_level in [key for key in heading_stack if key > level]:
        del heading_stack[deeper_level]


def _extract_heading_text(node) -> str:
    headline = node.find(class_="mw-headline")
    if headline is not None:
        return headline.get_text(strip=True)
    return node.get_text(strip=True)


def _extract_page_title(soup: BeautifulSoup) -> str:
    first_heading = soup.find(id="firstHeading")
    if first_heading is not None:
        text = first_heading.get_text(strip=True)
        if text:
            return text
    title_tag = soup.find("title")
    if title_tag is not None:
        title_text = title_tag.get_text(strip=True)
        if title_text:
            return title_text.split(" - ", 1)[0].strip()
    return ""


def _get_section_subdir(heading_stack: dict[int, str]) -> str | None:
    """根据当前标题栈生成目录路径片段，无标题时返回 None。"""
    parts = [sanitize_name(heading_stack[level]) for level in sorted(heading_stack) if heading_stack[level].strip()]
    if not parts:
        return None
    return str(Path(*parts))


def _get_heading_order_path(heading_stack: dict[int, str], heading_index_stack: dict[int, int]) -> tuple[int, ...]:
    levels = [level for level in sorted(heading_stack) if heading_stack[level].strip()]
    return tuple(heading_index_stack[level] for level in levels)


def extract_anchor_image_entries(category: str, page_url: str, soup: BeautifulSoup, max_entries: int = 0) -> list[ImageEntry]:
    """按页面标题层级分组提取图片条目，section 信息存入 ImageEntry.section 字段。"""
    entries: list[ImageEntry] = []
    seen_titles: set[str] = set()

    # 找到正文内容区域（mw-parser-output），在其中按文档顺序遍历节点
    content = soup.find("div", class_="mw-parser-output")
    if content is None:
        content = soup  # 降级：全页搜索

    heading_stack: dict[int, str] = {}
    heading_index_stack: dict[int, int] = {}
    page_title = _extract_page_title(soup)

    for node in content.children:
        tag = getattr(node, "name", None)
        heading_level = _get_heading_level(tag)
        if heading_level is not None:
            heading_text = _extract_heading_text(node)
            if heading_text:
                heading_index_stack[heading_level] = heading_index_stack.get(heading_level, 0) + 1
                for deeper_level in [key for key in heading_index_stack if key > heading_level]:
                    del heading_index_stack[deeper_level]
                _update_heading_stack(heading_stack, heading_level, heading_text)
            continue

        # 在当前节点（及其后代）中查找图片链接
        if tag is None:
            continue  # NavigableString，跳过

        for anchor in node.find_all("a", href=True):
            href = anchor["href"]
            if "/yuan/%E6%96%87%E4%BB%B6:" not in href:
                continue

            image = anchor.find("img")
            if image is None:
                continue

            src = image.get("src", "")
            if "patchwiki.biligame.com/images/yuan/" not in src:
                continue

            title = title_from_file_page_url(href)
            if title in seen_titles:
                continue

            original_url = original_from_thumb(src)
            seen_titles.add(title)
            section = _get_section_subdir(heading_stack)
            section_parts = tuple(section.split("\\")) if section else ()
            heading_order_path = _get_heading_order_path(heading_stack, heading_index_stack)
            entries.append(
                ImageEntry(
                    category=category,
                    title=title,
                    image_url=original_url,
                    source_page=page_url,
                    page_title=page_title,
                    section=section,
                    section_parts=section_parts,
                    heading_order_path=heading_order_path,
                    entry_order=len(entries) + 1,
                )
            )
            if max_entries > 0 and len(entries) >= max_entries:
                return entries

    return entries


def extract_inline_image_entries(category: str, page_url: str, soup: BeautifulSoup, max_entries: int = 0) -> list[ImageEntry]:
    entries: list[ImageEntry] = []
    seen_titles: set[str] = set()

    content = soup.find("div", class_="mw-parser-output")
    if content is None:
        content = soup

    heading_stack: dict[int, str] = {}
    heading_index_stack: dict[int, int] = {}
    page_title = _extract_page_title(soup)

    for node in content.children:
        tag = getattr(node, "name", None)
        heading_level = _get_heading_level(tag)
        if heading_level is not None:
            heading_text = _extract_heading_text(node)
            if heading_text:
                heading_index_stack[heading_level] = heading_index_stack.get(heading_level, 0) + 1
                for deeper_level in [key for key in heading_index_stack if key > heading_level]:
                    del heading_index_stack[deeper_level]
                _update_heading_stack(heading_stack, heading_level, heading_text)
            continue

        if tag is None:
            continue

        for image in node.find_all("img"):
            src = image.get("src", "")
            if "patchwiki.biligame.com/images/yuan/" not in src:
                continue

            classes = image.get("class") or []
            if category == "柬帖匣汇总" and "showOnImgBox" not in classes:
                continue

            original_url = None
            srcset = image.get("srcset", "")
            if srcset:
                original_url = extract_original_from_srcset(srcset)
            if not original_url:
                original_url = original_from_thumb(src)
            title = sanitize_name(Path(image.get("alt", "")).stem)
            if not title or title == "unnamed":
                title = sanitize_name(Path(unquote(urlparse(original_url).path)).stem)
            if title in seen_titles:
                continue

            seen_titles.add(title)
            section = _get_section_subdir(heading_stack)
            section_parts = tuple(section.split("\\")) if section else ()
            heading_order_path = _get_heading_order_path(heading_stack, heading_index_stack)
            entries.append(
                ImageEntry(
                    category=category,
                    title=title,
                    image_url=original_url,
                    source_page=page_url,
                    page_title=page_title,
                    section=section,
                    section_parts=section_parts,
                    heading_order_path=heading_order_path,
                    entry_order=len(entries) + 1,
                )
            )
            if max_entries > 0 and len(entries) >= max_entries:
                return entries

    return entries


def collect_entries(session: requests.Session, category: str, page_url: str, max_entries: int = 0) -> list[ImageEntry]:
    soup = fetch_soup(session, page_url)

    entries = extract_anchor_image_entries(category, page_url, soup, max_entries=max_entries)
    if entries:
        return entries

    return extract_inline_image_entries(category, page_url, soup, max_entries=max_entries)


def build_preferred_path(target_dir: Path, title: str, extension: str) -> Path:
    return target_dir / f"{sanitize_name(title)}{extension}"


def ensure_unique_path(target_dir: Path, title: str, extension: str, used_names: set[str]) -> Path:
    candidate = sanitize_name(title)
    filename = f"{candidate}{extension}"
    if filename not in used_names:
        used_names.add(filename)
        return target_dir / filename

    index = 2
    while True:
        filename = f"{candidate}_{index}{extension}"
        if filename not in used_names and not (target_dir / filename).exists():
            used_names.add(filename)
            return target_dir / filename
        index += 1


def iter_target_categories(names: Iterable[str] | None) -> dict[str, str]:
    if not names:
        return TARGET_CATEGORIES

    selected: dict[str, str] = {}
    alias_map = {name.lower(): (name, url) for name, url in TARGET_CATEGORIES.items()}
    for raw_name in names:
        key = raw_name.strip().lower()
        matched = alias_map.get(key)
        if matched is None:
            raise ValueError(f"未知分类: {raw_name}")
        selected[matched[0]] = matched[1]
    return selected


def download_file(session: requests.Session, url: str, target_path: Path, retries: int = 3) -> None:
    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, timeout=60, stream=True)
            if response.status_code == 567:
                wait = attempt * 3
                time.sleep(wait)
                continue
            response.raise_for_status()
            with target_path.open("wb") as file_obj:
                for chunk in response.iter_content(chunk_size=1024 * 64):
                    if chunk:
                        file_obj.write(chunk)
            return
        except requests.exceptions.RequestException as exc:
            last_exc = exc
            if attempt < retries:
                wait = attempt * 3
                time.sleep(wait)
            else:
                raise
    raise last_exc  # type: ignore[misc]


def format_progress_line(category: str, index: int, total: int, downloaded: int, skipped: int, failed: int, status: str, detail: str) -> str:
    safe_detail = detail.replace("\r", " ").replace("\n", " ")
    max_detail_length = 72
    if len(safe_detail) > max_detail_length:
        safe_detail = f"{safe_detail[:max_detail_length - 3]}..."
    return (
        f"\r[{category}] {index}/{total} "
        f"下载:{downloaded} 跳过:{skipped} 失败:{failed} "
        f"{status}: {safe_detail}"
    )


def print_progress_line(category: str, index: int, total: int, downloaded: int, skipped: int, failed: int, status: str, detail: str) -> None:
    line = format_progress_line(category, index, total, downloaded, skipped, failed, status, detail)
    print(line.ljust(160), end="", flush=True)


def finish_progress_line() -> None:
    print()


@dataclass(frozen=True)
class PreparedDownload:
    index: int
    entry: ImageEntry
    target_path: Path
    status: str
    reason: str


@dataclass(frozen=True)
class DownloadResult:
    index: int
    entry: ImageEntry
    target_path: Path
    status: str
    reason: str
    error: str = ""


def prepare_downloads(entries: list[ImageEntry], category_dir: Path, force: bool) -> list[PreparedDownload]:
    used_names_by_dir: dict[Path, set[str]] = {}
    prepared: list[PreparedDownload] = []

    for index, entry in enumerate(entries, start=1):
        extension = infer_extension_from_url(entry.image_url)
        target_dir = category_dir / entry.section if entry.section else category_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        used_names = used_names_by_dir.setdefault(target_dir, set())
        preferred_path = build_preferred_path(target_dir, entry.title, extension)

        if preferred_path.exists() and not force:
            used_names.add(preferred_path.name)
            prepared.append(
                PreparedDownload(
                    index=index,
                    entry=entry,
                    target_path=preferred_path,
                    status="skipped",
                    reason="已存在",
                )
            )
            continue

        if force:
            used_names.add(preferred_path.name)
            prepared.append(
                PreparedDownload(
                    index=index,
                    entry=entry,
                    target_path=preferred_path,
                    status="pending",
                    reason="覆盖下载",
                )
            )
            continue

        target_path = ensure_unique_path(target_dir, entry.title, extension, used_names)
        prepared.append(
            PreparedDownload(
                index=index,
                entry=entry,
                target_path=target_path,
                status="pending",
                reason="新文件下载",
            )
        )

    return prepared


def execute_download(prepared: PreparedDownload, use_env_proxy: bool) -> DownloadResult:
    if prepared.status == "skipped":
        return DownloadResult(
            index=prepared.index,
            entry=prepared.entry,
            target_path=prepared.target_path,
            status="skipped",
            reason=prepared.reason,
        )

    try:
        session = get_thread_session(use_env_proxy=use_env_proxy)
        download_file(session, prepared.entry.image_url, prepared.target_path)
        return DownloadResult(
            index=prepared.index,
            entry=prepared.entry,
            target_path=prepared.target_path,
            status="downloaded",
            reason=prepared.reason,
        )
    except Exception as exc:
        return DownloadResult(
            index=prepared.index,
            entry=prepared.entry,
            target_path=prepared.target_path,
            status="failed",
            reason=prepared.reason,
            error=str(exc),
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="下载代号鸢 wiki 指定分类头像")
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"输出目录，默认: {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument(
        "--category",
        action="append",
        help="指定分类名称，可重复传入；默认下载红框内全部分类",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="覆盖已存在文件",
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
        default=0.0,
        help="每个分类下载完成后的暂停秒数，默认 0",
    )
    parser.add_argument(
        "--use-env-proxy",
        action="store_true",
        help="默认忽略系统代理；传入后改为使用系统代理",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_MAX_WORKERS,
        help=f"并发下载线程数，默认 {DEFAULT_MAX_WORKERS}",
    )
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    session = build_session(use_env_proxy=args.use_env_proxy)
    categories = iter_target_categories(args.category)
    max_workers = max(1, args.workers)

    manifest: dict[str, list[dict[str, str]]] = {}
    downloaded = 0
    skipped = 0
    failed = 0

    for category, page_url in categories.items():
        print(f"\n==> 解析分类: {category}")
        entries = collect_entries(session, category, page_url, max_entries=args.limit)

        category_dir = output_dir / sanitize_name(category)
        category_dir.mkdir(parents=True, exist_ok=True)
        manifest[category] = []
        prepared_downloads = prepare_downloads(entries, category_dir, force=args.force)

        print(f"    找到 {len(entries)} 张可下载图片")
        completed = 0
        category_downloaded = 0
        category_skipped = 0
        category_failed = 0

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(execute_download, prepared, args.use_env_proxy): prepared
                for prepared in prepared_downloads
            }

            results_by_index: dict[int, DownloadResult] = {}
            for future in as_completed(future_map):
                result = future.result()
                results_by_index[result.index] = result
                completed += 1

                if result.status == "downloaded":
                    downloaded += 1
                    category_downloaded += 1
                    progress_status = "已下载"
                elif result.status == "skipped":
                    skipped += 1
                    category_skipped += 1
                    progress_status = "已跳过"
                else:
                    failed += 1
                    category_failed += 1
                    progress_status = "失败"

                detail_path = result.target_path.relative_to(output_dir).as_posix()
                print_progress_line(
                    category=category,
                    index=completed,
                    total=len(prepared_downloads),
                    downloaded=category_downloaded,
                    skipped=category_skipped,
                    failed=category_failed,
                    status=progress_status,
                    detail=detail_path,
                )

        finish_progress_line()

        for index in range(1, len(prepared_downloads) + 1):
            result = results_by_index[index]
            manifest_entry = {
                "title": result.entry.title,
                "url": result.entry.image_url,
                "source_page": result.entry.source_page,
                "page_title": result.entry.page_title,
                "section": result.entry.section or "",
                "section_parts": list(result.entry.section_parts),
                "heading_order_path": list(result.entry.heading_order_path),
                "entry_order": result.entry.entry_order,
                "path": str(result.target_path.as_posix()),
                "status": result.status,
            }
            if result.error:
                manifest_entry["error"] = result.error
            manifest[category].append(manifest_entry)

        if category_failed > 0:
            print(f"    分类完成：下载 {category_downloaded}，跳过 {category_skipped}，失败 {category_failed}")

        if args.sleep > 0:
            time.sleep(args.sleep)

    manifest_path = output_dir / MANIFEST_NAME
    manifest_path.write_text(
        json.dumps(
            {
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "categories": manifest,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print("\n完成")
    print(f"  下载: {downloaded}")
    print(f"  跳过: {skipped}")
    print(f"  失败: {failed}")
    print(f"  清单: {manifest_path}")
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
