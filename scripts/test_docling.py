#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Docling测试脚本 - 验证安装和基本功能
"""

import sys
import io

# 设置标准输出为UTF-8编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_imports():
    """测试导入"""
    print("[TEST] Testing imports...")
    try:
        from docling.document_converter import DocumentConverter
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
        print("[PASS] All modules imported successfully")
        return True
    except Exception as e:
        print(f"[FAIL] Import failed: {e}")
        return False

def test_basic_functionality():
    """测试基本功能"""
    print("\n[TEST] Testing basic functionality...")
    try:
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        print("[PASS] DocumentConverter created successfully")
        return True
    except Exception as e:
        print(f"[FAIL] Functionality test failed: {e}")
        return False

def main():
    print("=" * 50)
    print("Docling Installation Verification Test")
    print("=" * 50)

    results = []
    results.append(("Import Test", test_imports()))
    results.append(("Functionality Test", test_basic_functionality()))

    print("\n" + "=" * 50)
    print("Test Results Summary:")
    print("=" * 50)

    all_passed = True
    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{name}: {status}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n[SUCCESS] All tests passed! Docling is correctly installed")
        sys.exit(0)
    else:
        print("\n[WARNING] Some tests failed, please check installation")
        sys.exit(1)

if __name__ == '__main__':
    main()
