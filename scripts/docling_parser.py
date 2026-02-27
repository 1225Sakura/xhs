#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Docling文档解析器
支持PDF、DOCX、PPTX、XLSX、图片等格式
启用OCR功能用于扫描文档
"""

import sys
import json
import os
import io
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend

# 设置标准输出为UTF-8编码，避免Windows控制台编码问题
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def parse_document(file_path, enable_ocr=True):
    """
    解析文档并提取文本内容

    Args:
        file_path: 文档文件路径
        enable_ocr: 是否启用OCR（默认True）

    Returns:
        dict: 包含解析结果的字典
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return {
                'success': False,
                'error': f'文件不存在: {file_path}'
            }

        # 配置PDF处理选项（启用OCR）
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = enable_ocr
        pipeline_options.do_table_structure = True

        # 创建文档转换器
        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options,
                    backend=PyPdfiumDocumentBackend
                )
            }
        )

        # 转换文档
        result = converter.convert(file_path)

        # 提取文本内容
        markdown_text = result.document.export_to_markdown()

        # 获取文档元数据
        metadata = {
            'file_name': os.path.basename(file_path),
            'file_size': os.path.getsize(file_path),
            'format': result.input.format.name if hasattr(result.input, 'format') else 'unknown',
            'page_count': len(result.document.pages) if hasattr(result.document, 'pages') else 0,
            'char_count': len(markdown_text)
        }

        return {
            'success': True,
            'content': markdown_text,
            'metadata': metadata
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }


def main():
    """
    主函数 - 从命令行参数读取文件路径并解析
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': '缺少文件路径参数'
        }, ensure_ascii=False))
        sys.exit(1)

    file_path = sys.argv[1]
    enable_ocr = True

    # 检查是否禁用OCR
    if len(sys.argv) >= 3 and sys.argv[2].lower() == 'no-ocr':
        enable_ocr = False

    # 解析文档
    result = parse_document(file_path, enable_ocr)

    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
