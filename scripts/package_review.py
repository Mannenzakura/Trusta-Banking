"""Compatibility entry point for the credential-screened release exporter."""
try:
    from scripts.package_release import main
except ModuleNotFoundError:
    from package_release import main
if __name__ == '__main__':
    raise SystemExit(main())
