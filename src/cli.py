"""Installed command entry point for the vocabulary processing script."""

from scripts.process_vocabulary import main

__all__ = ["main"]


if __name__ == "__main__":
    raise SystemExit(main())
