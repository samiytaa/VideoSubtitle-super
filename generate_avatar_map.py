#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
头像映射生成器
扫描 img/小头像 目录，生成头像名称到文件路径的映射
"""

import os
import json
from pathlib import Path

def generate_avatar_map(base_dir='img/小头像', output_file='avatar_map.txt'):
    """
    扫描指定目录，生成头像映射
    
    Args:
        base_dir: 头像目录的基础路径
        output_file: 输出文件路径
    """
    
    # 检查目录是否存在
    if not os.path.exists(base_dir):
        print(f"错误: 目录 '{base_dir}' 不存在")
        return
    
    avatar_map = {}
    supported_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
    
    # 遍历目录
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            # 获取文件扩展名
            file_path = Path(file)
            if file_path.suffix.lower() not in supported_extensions:
                continue
            
            # 获取相对路径
            full_path = os.path.join(root, file)
            relative_path = os.path.relpath(full_path, base_dir)
            
            # 使用文件名（不含扩展名）作为键
            avatar_name = file_path.stem
            
            # 存储映射（使用正斜杠，适配Web路径）
            avatar_map[avatar_name] = relative_path.replace('\\', '/')
    
    # 按键名排序
    sorted_map = dict(sorted(avatar_map.items()))
    
    # 写入文本文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("// 头像路径映射表\n")
        f.write("// 自动生成，请勿手动编辑\n")
        f.write("// 生成命令: python generate_avatar_map.py\n\n")
        f.write("export const avatarMap: { [key: string]: string } = {\n")
        
        items = list(sorted_map.items())
        for i, (name, path) in enumerate(items):
            comma = ',' if i < len(items) - 1 else ''
            f.write(f"  '{name}': '{path}'{comma}\n")
        
        f.write("};\n")
    
    # 同时生成 JSON 格式（可选）
    json_output = output_file.replace('.txt', '.json')
    with open(json_output, 'w', encoding='utf-8') as f:
        json.dump(sorted_map, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 成功生成头像映射")
    print(f"  - 找到 {len(sorted_map)} 个头像文件")
    print(f"  - TypeScript 映射: {output_file}")
    print(f"  - JSON 映射: {json_output}")
    print(f"\n前5个映射示例:")
    for i, (name, path) in enumerate(list(sorted_map.items())[:5]):
        print(f"  '{name}' -> '{path}'")
    
    if len(sorted_map) > 5:
        print(f"  ... 还有 {len(sorted_map) - 5} 个")

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='生成头像路径映射文件')
    parser.add_argument(
        '--dir',
        default='img/小头像',
        help='头像目录路径 (默认: img/小头像)'
    )
    parser.add_argument(
        '--output',
        default='avatar_map.txt',
        help='输出文件路径 (默认: avatar_map.txt)'
    )
    
    args = parser.parse_args()
    
    generate_avatar_map(args.dir, args.output)

if __name__ == '__main__':
    main()
