"""Pytest configuration and Windows DLL initialization for PyTorch & Intel MKL."""
import os
import pathlib
import sys

if sys.platform == "win32":
    for _dll_candidate in [
        pathlib.Path(sys.executable).parent / "Library" / "bin",
        pathlib.Path(os.environ.get("LOCALAPPDATA", ""))
        / "Packages"
        / "PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0"
        / "LocalCache"
        / "local-packages"
        / "Library"
        / "bin",
        pathlib.Path(os.environ.get("LOCALAPPDATA", ""))
        / "Packages"
        / "PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0"
        / "LocalCache"
        / "local-packages"
        / "Python311"
        / "site-packages"
        / "torch"
        / "lib",
    ]:
        if _dll_candidate.exists():
            try:
                os.add_dll_directory(str(_dll_candidate))
            except Exception:
                pass
